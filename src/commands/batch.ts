// BATCH command entry — invoked by `mise run run:batch`. Parses flags,
// runs the Mastra batch workflow, emits the result. No mise logic here.
import { readFileSync } from 'node:fs'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { inPath } from '../core/safepath.ts'
import { batchWorkflow } from '../workflows/batch.ts'

function loadUrls(values: Record<string, unknown>, positionals: string[]): string[] | null {
  if (typeof values.urls === 'string') {
    return values.urls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
  }
  if (typeof values.input === 'string') {
    return readFileSync(inPath(values.input), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }
  return positionals.length > 0 ? positionals : null
}

// Explicit-target command: the user named every URL, so completion is part of
// the contract — 0 all ok, 1 all failed, 3 partial.
function exitCode(result: unknown): number {
  const results = (result as { results?: { ok?: boolean }[] }).results ?? []
  const okCount = results.filter((r) => r.ok === true).length
  if (okCount === results.length) return 0
  return okCount === 0 ? 1 : 3
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    urls: { type: 'string' },
    input: { type: 'string' },
    concurrency: { type: 'string' },
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
  const inputData = {
    urls,
    concurrency: intFlag('batch', values, 'concurrency', { def: 4, min: 1, max: 32 }),
    timeoutMs: timeoutFlag('batch', values),
  }
  return runWorkflow('batch', batchWorkflow, inputData, { ...emitOpts(values), exitCode })
}

process.exit(await main())
