// Forgiving flag parsing (clig.dev) on top of node:util parseArgs, plus
// bounds-checked flag accessors shared by every command.
import { parseArgs } from 'node:util'
import { Effect } from 'effect'
import { COMMANDS } from '../cli/commands.ts'
import { EXIT } from '../cli/exit-codes.ts'
import { GLOBAL_OPTIONS } from '../cli/help.ts'
import { CliError, commandName } from './effect.ts'
import { logErr, parseFields } from './output.ts'

type FlagValue = string | boolean | string[] | undefined
interface ParsedArgs {
  values: Record<string, FlagValue>
  positionals: string[]
}

type OptionSpec = {
  type: 'string' | 'boolean'
  short?: string
  multiple?: boolean
  default?: string | boolean
}

const COMMON: Record<string, OptionSpec> = {
  help: { type: 'boolean', short: 'h' },
  json: { type: 'boolean', default: false },
  ndjson: { type: 'boolean', default: false },
  select: { type: 'string' },
  output: { type: 'string', short: 'o' },
  timeout: { type: 'string' },
}

// Retired flags the CLI ignores — still PARSED so a legacy `--format json`
// consumes its value instead of leaking it into positionals (a silent
// wrong-query hazard under strict:false), warned on stderr, never read.
const REMOVED: Record<string, OptionSpec> = {
  format: { type: 'string' },
  quiet: { type: 'boolean', short: 'q' },
}

function warnRemoved(values: Record<string, FlagValue>): Effect.Effect<void> {
  const used = Object.keys(REMOVED).filter((name) => values[name] !== undefined)
  return Effect.forEach(used, (name) => logErr(`webular: --${name} was removed and is ignored`), {
    concurrency: 1,
    discard: true,
  })
}

// Levenshtein distance over one rolling row; flag names are short.
const distance = (a: string, b: string): number => {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      const swap = (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, swap)
    }
    row = next
  }
  return row[b.length] ?? 0
}

type Near = { name: string; d: number }

// The declared flag at most 2 edits away from a mistyped one, if any.
const didYouMean = (unknown: string, known: string[]): string => {
  const near = known.reduce<Near | undefined>((best, name) => {
    const d = distance(unknown, name)
    const fits = d <= 2 && d < name.length
    return fits && (best === undefined || d < best.d) ? { name, d } : best
  }, undefined)
  return near === undefined ? '' : ` Did you mean '--${near.name}'?`
}

const usageFor = (cmd: string, own: string[]): string => {
  const desc = (COMMANDS as Record<string, string>)[cmd] ?? ''
  const head = [`webular ${cmd} — ${desc}`, '', 'USAGE', `  webular ${cmd} [options]`, '']
  return [...head, 'OPTIONS', ...own.map((name) => `  --${name}`), ...GLOBAL_OPTIONS].join('\n')
}

// --help prints usage on stdout and ends with exit 0 (an empty CliError
// message prints nothing); an unknown flag is a usage error (exit 2).
function checkFlags(
  values: Record<string, FlagValue>,
  known: Record<string, OptionSpec>,
  own: string[],
): Effect.Effect<void, CliError> {
  const cmd = commandName()
  if (values['help'] === true) {
    return Effect.sync(() => process.stdout.write(`${usageFor(cmd, own)}\n`)).pipe(
      Effect.andThen(Effect.fail(new CliError({ message: '', exitCode: 0 }))),
    )
  }
  const unknown = Object.keys(values).find((name) => !(name in known))
  if (unknown === undefined) return Effect.void
  const hint = didYouMean(unknown, Object.keys(known))
  const message = `${cmd}: unknown option '--${unknown}'.${hint} Run 'webular ${cmd} --help' for usage.`
  return Effect.fail(new CliError({ message, exitCode: 2 }))
}

export function parseFlags(
  argv: string[],
  extra: Record<string, OptionSpec> = {},
): Effect.Effect<ParsedArgs, CliError> {
  return Effect.suspend(() => {
    const options = { ...COMMON, ...REMOVED, ...extra }
    const parsed = parseArgs({ args: argv, options, allowPositionals: true, strict: false })
    const values = parsed.values as Record<string, FlagValue>
    return checkFlags(values, options, Object.keys(extra)).pipe(
      Effect.andThen(warnRemoved(values)),
      Effect.as({ values, positionals: parsed.positionals }),
    )
  })
}

interface IntRange {
  min: number
  max: number
}

function toInt(raw: FlagValue): number | null {
  const text = String(raw ?? '').trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isInteger(n) ? n : null
}

// Usage errors are terminal by design (clig: exit 2); runMain prints the
// message and sets the exit code.
function usageError(cmd: string, name: string, range: IntRange): CliError {
  const message = `${cmd}: --${name} must be an integer between ${range.min} and ${range.max}`
  return new CliError({ message, exitCode: EXIT.usage })
}

export function optIntFlag(
  cmd: string,
  values: Record<string, FlagValue>,
  name: string,
  range: IntRange,
): Effect.Effect<number | undefined, CliError> {
  const raw = values[name]
  if (raw === undefined) return Effect.succeed(undefined)
  const n = toInt(raw)
  if (n === null || n < range.min || n > range.max) return Effect.fail(usageError(cmd, name, range))
  return Effect.succeed(n)
}

export function intFlag(
  cmd: string,
  values: Record<string, FlagValue>,
  name: string,
  bounds: IntRange & { def: number },
): Effect.Effect<number, CliError> {
  return Effect.map(optIntFlag(cmd, values, name, bounds), (n) => n ?? bounds.def)
}

export function strFlag(values: Record<string, FlagValue>, name: string): string | undefined {
  const v = values[name]
  return typeof v === 'string' ? v : undefined
}

// The one --timeout contract every command shares (per request attempt).
export function timeoutFlag(
  cmd: string,
  values: Record<string, FlagValue>,
): Effect.Effect<number | undefined, CliError> {
  return optIntFlag(cmd, values, 'timeout', { min: 1, max: 600_000 })
}

export function emitOpts(values: Record<string, FlagValue>): {
  json: boolean
  ndjson: boolean
  fields?: string[] | undefined
  output?: string | undefined
} {
  return {
    json: Boolean(values['json']),
    ndjson: Boolean(values['ndjson']),
    fields: parseFields(strFlag(values, 'select')),
    output: strFlag(values, 'output'),
  }
}
