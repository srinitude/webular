// Argument router: maps `webular <command> ...` to a mise task invocation.
// Keeps the CLI deterministic — routing only, no capability logic here.
import { Effect, type Path } from 'effect'
import { logErr } from '../core/output.ts'
import { runTask } from '../mise/gateway.ts'
import { COMMAND_NAMES, type CommandName } from './commands.ts'
import { printHelp, printVersion } from './help.ts'

function isCommand(value: string): value is CommandName {
  return (COMMAND_NAMES as string[]).includes(value)
}

export function route(
  argv: string[],
  extraEnv: Record<string, string> = {},
): Effect.Effect<number, never, Path.Path> {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h') return printHelp()
  if (command === '--version' || command === '-V') return printVersion()
  if (!isCommand(command))
    return Effect.as(logErr(`webular: unknown command '${command}'. Run 'webular --help'.`), 2)
  return Effect.map(runTask(`run:${command}`, rest, extraEnv), (result) => result.exitCode)
}
