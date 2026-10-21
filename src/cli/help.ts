// Help + version text (clig.dev: helpful, discoverable, no surprises).
import { Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { COMMANDS } from './commands.ts'

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
  '  -h, --help        Show help',
  '  -V, --version     Show version',
]

export function printHelp(): Effect.Effect<number> {
  const head = [
    'webular — a command line tool for web research',
    '',
    'USAGE',
    '  webular <command> [options]',
    '',
    'COMMANDS',
  ]
  const cmds = Object.entries(COMMANDS).map(([name, desc]) => `  ${name.padEnd(10)} ${desc}`)
  const tail = [
    '',
    'GLOBAL OPTIONS',
    ...GLOBAL_OPTIONS,
    '',
    'EXIT CODES',
    '  0 success · 1 failure · 2 wrong usage',
    '  3 some items failed (batch) · 127 a tool is missing',
    '',
    'Every command runs through `mise run run:<command>`.',
  ]
  return print([...head, ...cmds, ...tail].join('\n'))
}
