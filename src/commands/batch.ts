// BATCH command entry — invoked by `mise run run:batch`. Parses flags,
// runs the Mastra batch workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { errMsg } from '../core/output.ts'
import { inPath } from '../core/safepath.ts'

function splitList(text: string, sep: string): string[] {
  return text
    .split(sep)
    .map((u) => u.trim())
    .filter(Boolean)
}

const loadUrls = Effect.fn('loadUrls')(function* (
  values: Record<string, unknown>,
  positionals: string[],
) {
  const { urls, input } = values
  if (typeof urls === 'string') return splitList(urls, ',')
  if (typeof input === 'string') {
    const path = yield* inPath(input)
    const text = yield* Effect.tryPromise({
      try: () => Bun.file(path).text(),
      catch: (cause) => new CliError({ message: errMsg(cause), exitCode: 1 }),
    })
    return splitList(text, '\n')
  }
  return positionals.length > 0 ? positionals : null
})

// Explicit-target command: the user named every URL, so completion is part of
// the contract — 0 all ok, 1 all failed, 3 partial.
function exitCode(result: unknown): number {
  const results = (result as { results?: { ok?: boolean }[] }).results ?? []
  const okCount = results.filter((r) => r.ok === true).length
  if (okCount === results.length) return 0
  return okCount === 0 ? 1 : 3
}

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    urls: { type: 'string' },
    input: { type: 'string' },
    concurrency: { type: 'string' },
  })
  const urls = yield* loadUrls(values, positionals)
  if (!urls || urls.length === 0) {
    const message = 'batch: missing URLs (pass --urls <url,...> or --input <file>)'
    return yield* new CliError({ message, exitCode: 2 })
  }
  if (urls.length > 1000) {
    return yield* new CliError({ message: 'batch: too many URLs (max 1000)', exitCode: 2 })
  }
  const inputData = {
    urls,
    concurrency: yield* intFlag('batch', values, 'concurrency', { def: 4, min: 1, max: 32 }),
    timeoutMs: yield* timeoutFlag('batch', values),
  }
  return yield* runWorkflow(
    'batch',
    () => import('../workflows/batch.ts'),
    (m) => m.batchWorkflow,
    inputData,
    { ...emitOpts(values), exitCode },
  )
})

runMain(main)
