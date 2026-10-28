// Help + version text (clig.dev: helpful, discoverable, no surprises).
// Rows wrap to the terminal width; a pipe or file gets whole lines.
import { Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { COMMANDS } from './commands.ts'
import { termWidth, wrap } from './style.ts'

const print = (text: string): Effect.Effect<number> =>
  Effect.sync(() => {
    process.stdout.write(`${text}\n`)
    return 0
  })

export function printVersion(): Effect.Effect<number> {
  return print(`webular ${pkg.version}`)
}

export const GLOBAL_OPTIONS = [
  '  --json            Print JSON (keys sorted; one line unless output is a terminal)',
  '  --ndjson          Print one JSON line per result item',
  '  --select <a,b>    Show only these top-level JSON fields',
  '  -o, --output <f>  Write the output to a file',
  '  --timeout <ms>    Time limit for each network try (default 30000)',
  '  --no-cache        Fetch every page fresh; skip the local page cache',
  '  --why             Show how results were picked',
  '  -h, --help        Show help',
  '  -V, --version     Show version',
]

const HEAD = [
  'webular — a command line tool for web research',
  "Built on Mastra and Effect. Jev, TypeSafe's decision model, makes its judgment calls.",
  '',
  'USAGE',
  '  webular <command> [options]',
  '  webular --why   How webular works',
  '',
  'COMMANDS',
]

const TAIL = [
  '',
  'EXIT CODES',
  '  0 success · 1 failure · 2 wrong usage',
  '  3 some items failed (batch) · 127 a tool is missing',
  '  128+n stopped by signal n (130 for Ctrl-C)',
  '',
  "Run 'webular <command> --help' to see its options.",
  "Run 'webular doctor' if something does not work.",
]

// Each block wraps under its own description column.
export function helpText(width: number): string {
  const block = (lines: readonly string[], indent: number) =>
    lines.map((line) => wrap(line, indent, width))
  const cmds = Object.entries(COMMANDS).map(([name, desc]) => `  ${name.padEnd(10)} ${desc}`)
  return [
    ...block(HEAD, 2),
    ...block(cmds, 13),
    '',
    'GLOBAL OPTIONS',
    ...block(GLOBAL_OPTIONS, 20),
    ...block(TAIL, 2),
  ].join('\n')
}

export function printHelp(): Effect.Effect<number> {
  return print(helpText(termWidth()))
}
