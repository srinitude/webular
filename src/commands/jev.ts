// JEV command entry — invoked by `mise run run:jev`. `learn` tests lessons on the
// recorded Jev calls; `correct` labels one recorded call as an eval case. No mise logic here.
import { Effect } from 'effect'
import { EXIT, settledExit } from '../cli/exit-codes.ts'
import { parseFlags, strFlag } from '../core/args.ts'
import { CliError, failureOf, runMain } from '../core/effect.ts'
import { Jev } from '../lib/jev/client.ts'
import { jevCommandMachine } from '../machines/jev-command.ts'

const HELP = [
  'webular jev learn                                                     test lessons on the recorded calls',
  'webular jev correct <call-id> <right-answer> [--input <file.json>]    label one recorded call',
  'example: webular jev correct call-42 yes',
].join('\n')

// Loaded only after the flags check, so a bad call never pays for linkedom.
const load = <M, A>(loader: () => Promise<M>, pick: (m: M) => A) =>
  Effect.map(Effect.promise(loader), pick)

const FLAGS = {
  action: { type: 'string' },
  id: { type: 'string' },
  label: { type: 'string' },
  input: { type: 'string' },
} as const

// The jev command machine decides every exit: --help (parseFlags prints it and
// fails with exit 0), usage errors, and a failed action's plain failure exit;
// any other exit a failure carries (usage, toolchain) passes through.
type JevEvent = 'HELP' | 'LEARN' | 'CORRECT' | 'USAGE_ERROR' | 'SUCCEEDED' | 'FAILED'
const exitFor = (...types: JevEvent[]) =>
  settledExit(
    jevCommandMachine,
    types.map((type) => ({ type })),
  )

const usage = (message: string) => new CliError({ message, exitCode: exitFor('USAGE_ERROR') })

const asHelp = (err: CliError) =>
  err.exitCode === EXIT.ok ? new CliError({ message: err.message, exitCode: exitFor('HELP') }) : err

const failed = (action: 'LEARN' | 'CORRECT') => (err: unknown) => {
  const { message, exitCode } = failureOf(err)
  return new CliError({
    message,
    exitCode: exitCode === EXIT.failure ? exitFor(action, 'FAILED') : exitCode,
  })
}

// No command, or one jev does not know: say what to pass next.
const badJev = (cmd: string | undefined): string =>
  cmd === undefined
    ? 'jev: missing a command. Pass learn or correct.'
    : `jev: '${cmd}' needs more, or is not a jev command. Use learn or correct.\n${HELP}`

const main = Effect.gen(function* () {
  // Positional form (`correct <id> <label> --input F`) or the plugin's flag form
  // (`--action correct --id X --label Y --input F`).
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), FLAGS).pipe(
    Effect.mapError(asHelp),
  )
  const named = strFlag(values, 'action')
  const cmd = named ?? positionals[0]
  const rest = named === undefined ? positionals.slice(1) : positionals
  const id = strFlag(values, 'id') ?? rest[0]
  const label = strFlag(values, 'label') ?? rest[1]
  if (cmd === 'learn') {
    yield* (yield* load(
      () => import('../lib/jev/learn/cli.ts'),
      (m) => m.learn,
    )).pipe(Effect.mapError(failed('LEARN')))
    return exitFor('LEARN', 'SUCCEEDED')
  }
  if (cmd === 'correct' && id && label) {
    const correct = yield* load(
      () => import('../lib/jev/learn/cli.ts'),
      (m) => m.correctCall,
    )
    yield* correct(id, label, strFlag(values, 'input')).pipe(Effect.mapError(failed('CORRECT')))
    return exitFor('CORRECT', 'SUCCEEDED')
  }
  if (cmd === 'correct')
    return yield* usage('jev: missing <call-id> and <right-answer>. Pass both after correct.')
  return yield* usage(badJev(cmd))
}).pipe(Effect.provide(Jev.live))

runMain(main)
