// MAP command entry — invoked by `mise run run:map`. Parses flags,
// runs the Mastra map workflow, emits the result. No mise logic here.
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, optIntFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { mapWorkflow } from '../workflows/map.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('map: missing <url> (pass --url <url> or a positional URL)')
    return 2
  }
  const inputData = {
    url,
    limit: optIntFlag('map', values, 'limit', { min: 1, max: 10_000 }),
    timeoutMs: timeoutFlag('map', values),
  }
  return runWorkflow('map', mapWorkflow, inputData, {
    ...emitOpts(values),
    exitCode: discoveryExit('links'),
  })
}

process.exit(await main())
