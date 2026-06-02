// ACT command entry — invoked by `mise run run:act`. Parses flags, runs the
// Mastra act workflow (agent-browser), emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { actWorkflow } from '../workflows/act.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    screenshot: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('act: missing <url> (pass --url <url> or a positional URL)')
    return 2
  }
  const inputData = { url, screenshot: values.screenshot as string | undefined }
  const opts = { json: Boolean(values.json), output: values.output as string | undefined }
  return runWorkflow('act', actWorkflow, inputData, opts)
}

process.exit(await main())
