// JEV command entry — invoked by `mise run run:jev`. `learn` tests lessons on the
// recorded Jev calls; `correct` labels one recorded call as an eval case. No mise logic here.
import { Effect } from 'effect'
import { settledExit } from '../cli/exit-codes.ts'
import { parseFlags, strFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
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

// The jev command machine decides every exit; --help (exit 0) is parseFlags'
// job, and a failed action propagates its error to runMain's failure exit.
const exitFor = (...types: ('LEARN' | 'CORRECT' | 'USAGE_ERROR' | 'SUCCEEDED')[]) =>
  settledExit(
    jevCommandMachine,
    types.map((type) => ({ type })),
  )

const usage = (message: string) => new CliError({ message, exitCode: exitFor('USAGE_ERROR') })

// No command, or one jev does not know: say what to pass next.
const badJev = (cmd: string | undefined): string =>
  cmd === undefined
    ? 'jev: missing a command. Pass learn or correct.'
    : `jev: '${cmd}' needs more, or is not a jev command. Use learn or correct.\n${HELP}`

const main = Effect.gen(function* () {
  // Positional form (`correct <id> <label> --input F`) or the plugin's flag form
  // (`--action correct --id X --label Y --input F`).
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), FLAGS)
  const named = strFlag(values, 'action')
  const cmd = named ?? positionals[0]
  const rest = named === undefined ? positionals.slice(1) : positionals
  const id = strFlag(values, 'id') ?? rest[0]
  const label = strFlag(values, 'label') ?? rest[1]
  if (cmd === 'learn') {
    yield* yield* load(() => import('../lib/jev/learn/cli.ts'), (m) => m.learn)
    return exitFor('LEARN', 'SUCCEEDED')
  }
  if (cmd === 'correct' && id && label) {
    const correct = yield* load(() => import('../lib/jev/learn/cli.ts'), (m) => m.correctCall)
    yield* correct(id, label, strFlag(values, 'input'))
    return exitFor('CORRECT', 'SUCCEEDED')
  }
  if (cmd === 'correct')
    return yield* usage('jev: missing <call-id> and <right-answer>. Pass both after correct.')
  return yield* usage(badJev(cmd))
}).pipe(Effect.provide(Jev.live))

runMain(main)
