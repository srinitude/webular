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

export function printHelp(): Effect.Effect<number> {
  const head = [
    'webular — universal web research CLI',
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
    '  --json            Emit JSON (sorted keys; one line unless stdout is a terminal)',
    '  --ndjson          Emit one JSON line per result item',
    '  --select <a,b>    Keep only these top-level JSON fields',
    '  -o, --output <f>  Write output to a file',
    '  --timeout <ms>    Network timeout per request attempt (default 30000)',
    '  -h, --help        Show help',
    '  -V, --version     Show version',
    '',
    'EXIT CODES',
    '  0 success · 1 failure · 2 usage error',
    '  3 partial failure (batch) · 127 toolchain missing',
    '',
    'Every command is routed through `mise run run:<command>`.',
  ]
  return print([...head, ...cmds, ...tail].join('\n'))
}
