// TASKS command entry — invoked by `mise run run:tasks`. Parses flags,
// runs the Mastra tasks workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { tasksWorkflow } from '../workflows/tasks.ts'

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2))
  return runWorkflow('tasks', tasksWorkflow, { cwd: process.cwd() }, emitOpts(values))
}

process.exit(await main())
