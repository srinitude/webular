// Help + version text (clig.dev: helpful, discoverable, no surprises).
import pkg from '../../package.json' with { type: 'json' }
import { COMMANDS } from './commands.ts'

export function printVersion(): number {
  process.stdout.write(`webular ${pkg.version}\n`)
  return 0
}

export function printHelp(): number {
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
    '  --json            Emit structured JSON',
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
  process.stdout.write(`${[...head, ...cmds, ...tail].join('\n')}\n`)
  return 0
}
