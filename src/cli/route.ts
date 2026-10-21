// Argument router: maps `webular <command> ...` to that command's own process.
// Keeps the CLI deterministic — routing only, no capability logic here.
import { Effect } from 'effect'
import { logErr } from '../core/output.ts'
import { COMMAND_NAMES, type CommandName } from './commands.ts'
import { runCommand } from './dispatch.ts'
import { printHelp, printVersion } from './help.ts'

function isCommand(value: string): value is CommandName {
  return (COMMAND_NAMES as string[]).includes(value)
}

export function route(argv: string[]) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h') return printHelp()
  if (command === '--version' || command === '-V') return printVersion()
  if (!isCommand(command))
    return Effect.as(logErr(`webular: unknown command '${command}'. Run 'webular --help'.`), 2)
  return runCommand(command, rest)
}
