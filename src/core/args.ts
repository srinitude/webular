// Forgiving flag parsing (clig.dev) on top of node:util parseArgs, plus
// bounds-checked flag accessors shared by every command.
import { parseArgs } from 'node:util'
import { logErr } from './output.ts'

type FlagValue = string | boolean | undefined
interface ParsedArgs {
  values: Record<string, FlagValue>
  positionals: string[]
}

type OptionSpec = { type: 'string' | 'boolean'; short?: string; default?: string | boolean }

const COMMON: Record<string, OptionSpec> = {
  json: { type: 'boolean', default: false },
  output: { type: 'string', short: 'o' },
  timeout: { type: 'string' },
}

// 0.1.1 flags removed in 0.2.0 — still PARSED so a legacy `--format json`
// consumes its value instead of leaking it into positionals (a silent
// wrong-query hazard under strict:false), warned on stderr, never read.
const REMOVED: Record<string, OptionSpec> = {
  format: { type: 'string' },
  quiet: { type: 'boolean', short: 'q' },
}

function warnRemoved(values: Record<string, FlagValue>): void {
  for (const name of Object.keys(REMOVED)) {
    if (values[name] !== undefined) logErr(`webular: --${name} was removed in 0.2.0 and is ignored`)
  }
}

export function parseFlags(argv: string[], extra: Record<string, OptionSpec> = {}): ParsedArgs {
  const parsed = parseArgs({
    args: argv,
    options: { ...COMMON, ...REMOVED, ...extra },
    allowPositionals: true,
    strict: false,
  })
  const values = parsed.values as Record<string, FlagValue>
  warnRemoved(values)
  return { values, positionals: parsed.positionals }
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

// Usage errors are terminal by design (clig: exit 2). The exit path is covered
// by the spawned command tests; unit tests exercise only the returning paths.
function usageExit(cmd: string, name: string, range: IntRange): never {
  logErr(`${cmd}: --${name} must be an integer between ${range.min} and ${range.max}`)
  process.exit(2)
}

export function optIntFlag(
  cmd: string,
  values: Record<string, FlagValue>,
  name: string,
  range: IntRange,
): number | undefined {
  const raw = values[name]
  if (raw === undefined) return undefined
  const n = toInt(raw)
  if (n === null || n < range.min || n > range.max) usageExit(cmd, name, range)
  return n
}

export function intFlag(
  cmd: string,
  values: Record<string, FlagValue>,
  name: string,
  bounds: IntRange & { def: number },
): number {
  return optIntFlag(cmd, values, name, bounds) ?? bounds.def
}

export function strFlag(values: Record<string, FlagValue>, name: string): string | undefined {
  const v = values[name]
  return typeof v === 'string' ? v : undefined
}

// The one --timeout contract every command shares (per request attempt).
export function timeoutFlag(cmd: string, values: Record<string, FlagValue>): number | undefined {
  return optIntFlag(cmd, values, 'timeout', { min: 1, max: 600_000 })
}

export function emitOpts(values: Record<string, FlagValue>): { json: boolean; output?: string } {
  return { json: Boolean(values.json), output: strFlag(values, 'output') }
}
