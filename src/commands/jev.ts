// JEV command entry — invoked by `mise run run:jev`. `learn` tests lessons on the
// recorded Jev calls; `correct` labels one recorded call as an eval case. No mise logic here.
import { Effect } from 'effect'
import { parseFlags, strFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { Jev } from '../lib/jev/client.ts'

const HELP = [
  'webular jev learn                                                     test lessons on the recorded calls',
  'webular jev correct <call-id> <right-answer> [--input <file.json>]    label one recorded call',
  'example: webular jev correct call-42 yes',
].join('\n')

// Loaded only after the flags check, so a bad call never pays for linkedom.
const load = <M, A>(loader: () => Promise<M>, pick: (m: M) => A) =>
  Effect.map(Effect.promise(loader), pick)

const usage = (message: string) => new CliError({ message, exitCode: 2 })

const main = Effect.gen(function* () {
  // Positional form (`correct <id> <label> --input F`) or the plugin's flag form
  // (`--action correct --id X --label Y --input F`).
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    action: { type: 'string' },
    id: { type: 'string' },
    label: { type: 'string' },
    input: { type: 'string' },
  })
  const named = strFlag(values, 'action')
  const cmd = named ?? positionals[0]
  const rest = named === undefined ? positionals.slice(1) : positionals
  const id = strFlag(values, 'id') ?? rest[0]
  const label = strFlag(values, 'label') ?? rest[1]
  if (cmd === undefined)
    return yield* usage(`jev: missing <action>. Pass learn or correct.\n${HELP}`)
  if (cmd === 'learn')
    yield* yield* load(
      () => import('../lib/jev/learn/cli.ts'),
      (m) => m.learn,
    )
  else if (cmd === 'correct' && id && label)
    yield* (yield* load(
      () => import('../lib/jev/learn/cli.ts'),
      (m) => m.correctCall,
    ))(id, label, strFlag(values, 'input'))
  else if (cmd === 'correct')
    return yield* usage('jev: missing <call-id> and <right-answer>. Pass both after correct.')
  else return yield* usage(`jev: unknown command '${cmd}'\n${HELP}`)
  return 0
}).pipe(Effect.provide(Jev.live))

runMain(main)
