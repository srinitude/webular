// EXTRACT command entry — invoked by `mise run run:extract`. Parses flags,
// runs the Mastra extract workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { extractWorkflow } from '../workflows/extract.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    fields: { type: 'string' },
    selector: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('extract: missing <url> (pass --url <url> or a positional URL)')
    return 2
  }
  if (!values.fields && !values.selector) {
    logErr('extract: pass --fields "name:selector[,...]" or --selector <css>')
    return 2
  }
  const inputData = {
    url,
    fields: values.fields as string | undefined,
    selector: values.selector as string | undefined,
    timeoutMs: timeoutFlag('extract', values),
  }
  return runWorkflow('extract', extractWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
