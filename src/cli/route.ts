// Argument router: maps `webular <command> ...` to that command's own process.
// Keeps the CLI deterministic — routing only, no capability logic here.
// The CLI-dispatch machine decides the exit of every local answer (help,
// version, unknown command); a known command passes its process's exit through.
import { Effect } from 'effect'
import { logErr } from '../core/output.ts'
import { cliDispatchMachine } from '../machines/cli-dispatch.ts'
import { COMMAND_NAMES, type CommandName } from './commands.ts'
import { runCommand } from './dispatch.ts'
import { settledExit } from './exit-codes.ts'
import { printHelp, printVersion } from './help.ts'

function isCommand(value: string): value is CommandName {
  return (COMMAND_NAMES as string[]).includes(value)
}

export function route(argv: string[]) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h')
    return Effect.as(printHelp(), settledExit(cliDispatchMachine, [{ type: 'HELP' }]))
  if (command === '--version' || command === '-V')
    return Effect.as(printVersion(), settledExit(cliDispatchMachine, [{ type: 'VERSION' }]))
  if (!isCommand(command))
    return Effect.as(
      logErr(`webular: unknown command '${command}'. Run 'webular --help'.`),
      settledExit(cliDispatchMachine, [{ type: 'UNKNOWN_COMMAND' }]),
    )
  return runCommand(command, rest)
}
