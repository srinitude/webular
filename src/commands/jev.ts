// JEV command entry — invoked by `mise run run:jev`. `learn` tests lessons on the
// recorded Jev calls; `correct` labels one recorded call as an eval case. No mise logic here.
import { Console, Effect } from 'effect'
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

const main = Effect.gen(function* () {
  // Positional form (`correct <id> <label> --input F`) or the plugin's flag form
  // (`--action correct --id X --label Y --input F`); `--json` is ignored.
  const args = Bun.argv.slice(2).filter((a) => a !== '--json')
  const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const named = args.includes('--action')
  const cmd = named ? flag('--action') : args[0]
  const id = named ? flag('--id') : args[1]
  const label = named ? flag('--label') : args[2]
  const file = flag('--input')
  if (cmd === 'learn')
    yield* yield* load(
      () => import('../lib/jev/learn/cli.ts'),
      (m) => m.learn,
    )
  else if (cmd === 'correct' && id && label)
    yield* (yield* load(
      () => import('../lib/jev/learn/cli.ts'),
      (m) => m.correctCall,
    ))(id, label, file)
  else if (cmd === undefined || cmd === '--help') yield* Console.log(HELP)
  else
    return yield* new CliError({
      message: `jev: unknown or incomplete command\n${HELP}`,
      exitCode: 2,
    })
  return 0
}).pipe(Effect.provide(Jev.live))

runMain(main)
