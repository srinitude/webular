// Forgiving flag parsing (clig.dev) on top of node:util parseArgs.
import { parseArgs } from 'node:util'

export type FlagValue = string | boolean | undefined
export interface ParsedArgs {
  values: Record<string, FlagValue>
  positionals: string[]
}

type OptionSpec = { type: 'string' | 'boolean'; short?: string; default?: string | boolean }

const COMMON: Record<string, OptionSpec> = {
  json: { type: 'boolean', default: false },
  format: { type: 'string', default: 'md' },
  output: { type: 'string', short: 'o' },
  quiet: { type: 'boolean', short: 'q', default: false },
  timeout: { type: 'string' },
}

export function parseFlags(argv: string[], extra: Record<string, OptionSpec> = {}): ParsedArgs {
  const parsed = parseArgs({
    args: argv,
    options: { ...COMMON, ...extra },
    allowPositionals: true,
    strict: false,
  })
  return { values: parsed.values as Record<string, FlagValue>, positionals: parsed.positionals }
}
