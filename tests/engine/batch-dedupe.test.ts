// A batch fetches each distinct URL once, yet still answers every input slot in order.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { batchWorkflow } from '../../src/workflows/batch.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const page = () =>
  new Response('<html><head><title>Once</title></head><body><p>hello</p></body></html>', {
    headers: { 'content-type': 'text/html', 'cache-control': 'no-store' },
  })

describe('batch dedupes target URLs', () => {
  test(
    'three copies of one URL make one request and three results',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(() => ({ '/once': page, '/other': page }))
        const once = `${fx.origin}/once`
        const other = `${fx.origin}/other`
        const run = yield* io(() => batchWorkflow.createRun())
        const out = yield* io(() => run.start({ inputData: { urls: [once, other, once, once] } }))
        // A failed run shows its cause, not only its status.
        expect(out.status === 'failed' ? out.error.message : out.status).toBe('success')
        if (out.status !== 'success') return
        expect(out.result.results.map((r) => r.url)).toEqual([once, other, once, once])
        expect(out.result.count).toBe(4)
        expect(fx.hits('/once')).toBe(1)
      }),
    ),
    15_000,
  )
})
