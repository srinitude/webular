// MEDIA command entry — invoked by `mise run run:media`. Parses flags,
// runs the Mastra media workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { mediaWorkflow } from '../workflows/media.ts'

function resolveAction(values: Record<string, unknown>): 'download' | 'screenshot' | 'pdf' {
  if (values.screenshot) return 'screenshot'
  if (values.pdf) return 'pdf'
  return 'download'
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    download: { type: 'boolean', default: false },
    screenshot: { type: 'boolean', default: false },
    pdf: { type: 'boolean', default: false },
  })
  const url = values.url as string | undefined
  if (!url) {
    logErr('media: missing --url <url>')
    return 2
  }
  const inputData = {
    url,
    action: resolveAction(values),
    dest: values.output as string | undefined,
  }
  return runWorkflow('media', mediaWorkflow, inputData, { json: Boolean(values.json) })
}

process.exit(await main())
