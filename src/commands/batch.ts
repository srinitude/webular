// BATCH command entry — invoked by `mise run run:batch`. Parses flags,
// runs the Mastra batch workflow, emits the result. No mise logic here.
import { readFileSync } from 'node:fs'
import { runWorkflow } from '../cli/run.ts'
import { parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { batchWorkflow } from '../workflows/batch.ts'

function loadUrls(values: Record<string, unknown>, positionals: string[]): string[] | null {
  if (typeof values.urls === 'string') {
    return values.urls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
  }
  if (typeof values.input === 'string') {
    return readFileSync(values.input, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }
  return positionals.length > 0 ? positionals : null
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    op: { type: 'string', default: 'scrape' },
    urls: { type: 'string' },
    input: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
  })
  const urls = loadUrls(values, positionals)
  if (!urls || urls.length === 0) {
    logErr('batch: missing URLs (pass --urls <url,...> or --input <file>)')
    return 2
  }
  if (urls.length > 1000) {
    logErr('batch: too many URLs (max 1000)')
    return 2
  }
  const op = (values.op as string) ?? 'scrape'
  if (op !== 'scrape') {
    logErr(`batch: unknown op "${op}" (only "scrape" is supported)`)
    return 2
  }
  const concurrency = Math.min(
    32,
    Math.max(1, Number.parseInt(String(values.concurrency ?? '4'), 10) || 4),
  )
  const opts = { json: Boolean(values.json), output: values.output as string | undefined }
  return runWorkflow('batch', batchWorkflow, { op, urls, concurrency }, opts)
}

process.exit(await main())
