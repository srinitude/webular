// DOCTOR command entry — invoked by `mise run run:doctor`. Runs diagnostics,
// emits { ok, checks }. No required flags.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { doctorWorkflow } from '../workflows/doctor.ts'

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {})
  return runWorkflow('doctor', doctorWorkflow, {}, emitOpts(values))
}

process.exit(await main())
