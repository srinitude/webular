// RESEARCH command entry — invoked by `mise run run:research`. Parses flags,
// runs the Mastra research workflow, emits the result. No mise logic here.
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { researchWorkflow } from '../workflows/research.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    topic: { type: 'string', short: 't' },
    depth: { type: 'string' },
    sentences: { type: 'string' },
  })
  const topic = (values.topic as string) ?? positionals[0]
  if (!topic) {
    logErr('research: missing --topic <t> (or pass topic as a positional)')
    return 2
  }
  const inputData = {
    topic,
    depth: intFlag('research', values, 'depth', { def: 3, min: 1, max: 10 }),
    sentences: intFlag('research', values, 'sentences', { def: 2, min: 1, max: 25 }),
    timeoutMs: timeoutFlag('research', values),
  }
  return runWorkflow('research', researchWorkflow, inputData, {
    ...emitOpts(values),
    exitCode: discoveryExit('sources'),
  })
}

process.exit(await main())
