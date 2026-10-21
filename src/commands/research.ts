// RESEARCH command entry — invoked by `mise run run:research`. Parses flags,
// runs the Mastra research workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    topic: { type: 'string', short: 't' },
    depth: { type: 'string' },
    sentences: { type: 'string' },
  })
  const topic = (values.topic as string) ?? positionals[0]
  if (!topic) {
    return yield* new CliError({
      message: 'research: missing --topic <t> (or pass topic as a positional)',
      exitCode: 2,
    })
  }
  const inputData = {
    topic,
    depth: yield* intFlag('research', values, 'depth', { def: 3, min: 1, max: 10 }),
    sentences: yield* intFlag('research', values, 'sentences', { def: 2, min: 1, max: 25 }),
    timeoutMs: yield* timeoutFlag('research', values),
  }
  return yield* runWorkflow(
    'research',
    () => import('../workflows/research.ts'),
    (m) => m.researchWorkflow,
    inputData,
    {
      ...emitOpts(values),
      exitCode: discoveryExit('sources'),
    },
  )
})

runMain(main)
