// SUMMARIZE command entry — invoked by `mise run run:summarize`. Parses flags,
// runs the Mastra summarize workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { summarizeWorkflow } from '../workflows/summarize.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    text: { type: 'string' },
    url: { type: 'string' },
    sentences: { type: 'string' },
  })
  const text = values.text as string | undefined
  const url = (values.url as string | undefined) ?? positionals[0]
  const sentences = values.sentences ? Number.parseInt(values.sentences as string, 10) : 3
  if (!text && !url) {
    logErr('summarize: missing input (pass --text <text> or --url <url>)')
    return 2
  }
  if (Number.isNaN(sentences) || sentences < 1) {
    logErr('summarize: --sentences must be a positive integer')
    return 2
  }
  const opts = { json: Boolean(values.json), output: values.output as string | undefined }
  return runWorkflow('summarize', summarizeWorkflow, { text, url, sentences }, opts)
}

process.exit(await main())
