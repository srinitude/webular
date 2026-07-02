// AUDIT command entry — invoked by `mise run run:audit`. Reports deepsec
// availability and the scan plan (keyless). No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { auditWorkflow } from '../workflows/audit.ts'

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {})
  return runWorkflow('audit', auditWorkflow, {}, emitOpts(values))
}

process.exit(await main())
