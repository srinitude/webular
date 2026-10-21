// Forgiving flag parsing (clig.dev) on top of node:util parseArgs, plus
// bounds-checked flag accessors shared by every command.
import { parseArgs } from 'node:util'
import { Effect } from 'effect'
import { CliError } from './effect.ts'
import { logErr, parseFields } from './output.ts'

type FlagValue = string | boolean | undefined
interface ParsedArgs {
  values: Record<string, FlagValue>
  positionals: string[]
}

type OptionSpec = { type: 'string' | 'boolean'; short?: string; default?: string | boolean }

const COMMON: Record<string, OptionSpec> = {
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

export function parseFlags(
  argv: string[],
  extra: Record<string, OptionSpec> = {},
): Effect.Effect<ParsedArgs> {
  return Effect.suspend(() => {
    const parsed = parseArgs({
      args: argv,
      options: { ...COMMON, ...REMOVED, ...extra },
      allowPositionals: true,
      strict: false,
    })
    const values = parsed.values as Record<string, FlagValue>
    return Effect.as(warnRemoved(values), { values, positionals: parsed.positionals })
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
  return new CliError({ message, exitCode: 2 })
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
  fields?: string[]
  output?: string
} {
  return {
    json: Boolean(values.json),
    ndjson: Boolean(values.ndjson),
    fields: parseFields(strFlag(values, 'select')),
    output: strFlag(values, 'output'),
  }
}
