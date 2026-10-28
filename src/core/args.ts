// Forgiving flag parsing (clig.dev) on top of node:util parseArgs, plus
// bounds-checked flag accessors shared by every command.
import { parseArgs } from 'node:util'
import { Effect } from 'effect'
import { ARGUMENTS, CLI_ONLY_HELP, COMMANDS, EXAMPLES } from '../cli/commands.ts'
import { EXIT } from '../cli/exit-codes.ts'
import { GLOBAL_OPTIONS } from '../cli/help.ts'
import { distance } from '../cli/style.ts'
import { CliError, commandName } from './effect.ts'
import { logErr, parseFields } from './output.ts'

type FlagValue = string | boolean | string[] | undefined
type ParsedArgs = { values: Record<string, FlagValue>; positionals: string[] }

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
  // Read by dispatch.ts (it sets WEBULAR_NO_CACHE); parsed here so no command rejects it.
  'no-cache': { type: 'boolean' },
  why: { type: 'boolean', default: false },
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

// The declared flag at most 2 edits away from a mistyped one, if any.
const didYouMean = (unknown: string, known: string[]): string => {
  const near = known
    .map((name) => ({ name, d: distance(unknown, name) }))
    .filter(({ name, d }) => d <= 2 && d < name.length)
    .sort((x, y) => x.d - y.d)[0]
  return near === undefined ? '' : ` Did you mean '--${near.name}'?`
}

// A list flag: repeat it (--urls a --urls b) or join with commas. A comma
// splits only when a new URL (scheme://) follows, so https://x.com/a,b stays whole.
export const listFlag = (raw: unknown): string[] | undefined =>
  typeof raw === 'string' || Array.isArray(raw)
    ? [raw]
        .flat()
        .flatMap((item) => String(item).split(/,(?=\s*[a-z][a-z0-9+.-]*:\/\/)/i))
        .map((u) => u.trim())
        .filter(Boolean)
    : undefined

type Described = { description?: string; def?: { type?: string }; unwrap?: () => Described }

// One OPTIONS line per flag from the MCP tool's zod schema, so CLI help and schema cannot drift.
const optionLine = (cmd: string, shape: Record<string, Described>, name: string): string => {
  const key = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  const field = shape[key] ?? shape[name]
  const inner = field?.def?.type === 'optional' ? field.unwrap?.() : field
  const takes = inner?.def?.type === 'boolean' ? '' : ' <value>'
  const extra = (CLI_ONLY_HELP as Record<string, Record<string, string>>)[cmd]?.[name]
  const desc = field?.description ?? inner?.description ?? extra ?? ''
  const head = `  --${name}${takes}`
  return desc ? `${head.padEnd(19)} ${desc}` : head
}

const usageFor = (cmd: string, own: string[], shape: Record<string, Described>): string => {
  const desc = (COMMANDS as Record<string, string>)[cmd] ?? ''
  const main = (ARGUMENTS as Record<string, string>)[cmd]
  const usage = `  webular ${cmd}${main ? ` ${main}` : ''} [options]`
  const head = [`webular ${cmd} — ${desc}`, '', 'USAGE', usage, '']
  const example = (EXAMPLES as Record<string, string>)[cmd]
  const tail = example ? ['', 'EXAMPLE', `  ${example}`] : []
  const options = own.map((name) => optionLine(cmd, shape, name))
  return [...head, 'OPTIONS', ...options, ...GLOBAL_OPTIONS, ...tail].join('\n')
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
    // Loaded only for --help, so zod never slows a normal run.
    return Effect.promise(() => import('../../plugins/webular/src/schemas.ts')).pipe(
      Effect.map(
        ({ schemas }) =>
          ((schemas as Record<string, { shape: Record<string, Described> }>)[cmd]?.shape ??
            {}) as Record<string, Described>,
      ),
      Effect.flatMap((shape) =>
        Effect.sync(() => process.stdout.write(`${usageFor(cmd, own, shape)}\n`)),
      ),
      Effect.andThen(Effect.fail(new CliError({ message: '', exitCode: 0 }))),
    )
  }
  if (typeof values['why'] === 'string')
    return Effect.fail(new CliError({ message: `${cmd}: --why takes no value.`, exitCode: 2 }))
  const unknown = Object.keys(values).find((name) => !(name in known))
  if (unknown === undefined) return Effect.void
  const hint = didYouMean(unknown, Object.keys(known))
  const message = `${cmd}: unknown option '--${unknown}'.${hint} Run 'webular ${cmd} --help' to see how to use it.`
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

type IntRange = { min: number; max: number }
function toInt(raw: FlagValue): number | null {
  const text = String(raw ?? '').trim()
  const n = text === '' ? Number.NaN : Number(text)
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

type Picks = { fields?: string[] | undefined; output?: string | undefined; why?: true }
export const emitOpts = (
  values: Record<string, FlagValue>,
): { json: boolean; ndjson: boolean } & Picks => ({
  ...(values['why'] === true && { why: true as const }),
  json: Boolean(values['json']),
  ndjson: Boolean(values['ndjson']),
  fields: parseFields(strFlag(values, 'select')),
  output: strFlag(values, 'output'),
})
