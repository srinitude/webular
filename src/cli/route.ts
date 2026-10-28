// Argument router: maps `webular <command> ...` to that command's own process.
// Keeps the CLI deterministic — routing only, no capability logic here.
// The CLI-dispatch machine decides the exit of every local answer (help,
// version, unknown command) and whether a known command succeeded; a failed
// command passes its process's own exit through.
import { Effect } from 'effect'
import { logErr } from '../core/output.ts'
import { suggestDecision } from '../lib/jev/decisions/cli-suggest.ts'
import { onJevRuntime } from '../lib/jev/run.ts'
import { cliDispatchMachine } from '../machines/cli-dispatch.ts'
import { COMMAND_NAMES, type CommandName } from './commands.ts'
import { runCommand } from './dispatch.ts'
import { EXIT, settledExit } from './exit-codes.ts'
import { printHelp, printVersion } from './help.ts'
import { errorLabel, safeText } from './style.ts'
import { withUpdateNotice } from './update-notice.ts'
import { printWhy } from './why.ts'

function isCommand(value: string): value is CommandName {
  return (COMMAND_NAMES as string[]).includes(value)
}

// Usage error on stderr: the command Jev reads as meant (a typo or an intent
// word; the edit-distance rule below the 0.95 bar), then where to look.
function unknownCommand(command: string): Effect.Effect<number> {
  const kind = command.startsWith('-') ? 'option' : 'command'
  return Effect.all([onJevRuntime(suggestDecision, { command }), errorLabel]).pipe(
    Effect.flatMap(([guess, label]) =>
      logErr(
        `${label} unknown ${kind} '${safeText(command)}'.${guess ? ` Did you mean '${guess}'?` : ''}\nRun 'webular --help' to see all commands.`,
      ),
    ),
    Effect.as(settledExit(cliDispatchMachine, [{ type: 'UNKNOWN_COMMAND' }])),
  )
}

// Bare --why: how webular picks results, offline; a local answer like --help.
// Only --json or --ndjson may join it; anything else is wrong usage (exit 2).
function bareWhy(rest: string[]): Effect.Effect<number> {
  const extra = rest.filter((a) => a !== '--json' && a !== '--ndjson')
  if (extra.length > 0)
    return errorLabel.pipe(
      Effect.flatMap((label) =>
        logErr(`${label} --why goes after the command: webular ${safeText(extra.join(' '))} --why`),
      ),
      Effect.as(EXIT.usage),
    )
  const form = rest.includes('--ndjson') ? 'ndjson' : rest.includes('--json') ? 'json' : 'human'
  return Effect.as(printWhy(form), settledExit(cliDispatchMachine, [{ type: 'HELP' }]))
}

export function route(argv: string[]) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h')
    return Effect.as(printHelp(), settledExit(cliDispatchMachine, [{ type: 'HELP' }]))
  if (command === '--version' || command === '-V')
    return Effect.as(printVersion(), settledExit(cliDispatchMachine, [{ type: 'VERSION' }]))
  if (command === '--why') return bareWhy(rest)
  if (!isCommand(command)) return unknownCommand(command)
  return Effect.map(withUpdateNotice(argv, runCommand(command, rest)), (code) =>
    settledExit(cliDispatchMachine, [
      { type: 'KNOWN_COMMAND' },
      { type: code === EXIT.ok ? 'TASK_SUCCEEDED' : 'TASK_FAILED' },
    ]) === EXIT.ok
      ? EXIT.ok
      : code,
  )
}
