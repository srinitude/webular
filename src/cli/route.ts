// Argument router: maps `webular <command> ...` to a mise task invocation.
// Keeps the CLI deterministic — routing only, no capability logic here.
import { runTask } from '../mise/gateway.ts'
import { COMMAND_NAMES, type CommandName } from './commands.ts'
import { printHelp, printVersion } from './help.ts'

function isCommand(value: string): value is CommandName {
  return (COMMAND_NAMES as string[]).includes(value)
}

export async function route(argv: string[]): Promise<number> {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h') return printHelp()
  if (command === '--version' || command === '-V') return printVersion()
  if (!isCommand(command)) {
    process.stderr.write(`webular: unknown command '${command}'. Run 'webular --help'.\n`)
    return 1
  }
  return (await runTask(`run:${command}`, rest)).exitCode
}
