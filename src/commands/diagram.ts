// DIAGRAM command entry — invoked by `mise run run:diagram`. Lists the design
// diagrams (pre-rendered SVGs ship in docs/diagrams). No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { diagramWorkflow } from '../workflows/diagram.ts'

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2))
  return runWorkflow('diagram', diagramWorkflow, {}, emitOpts(values))
}

process.exit(await main())
