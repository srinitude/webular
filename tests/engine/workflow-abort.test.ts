// Cancelling a workflow run drops the in-flight HTTP request: the step's
// abortSignal reaches the Effect runtime, which interrupts the fetch.
import { describe, test } from 'bun:test'
import { Deferred, Effect } from 'effect'
import { batchWorkflow } from '../../src/workflows/batch.ts'
import { scrapeWorkflow } from '../../src/workflows/scrape.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

interface Handle {
  start: () => Promise<unknown>
  cancel: () => Promise<unknown>
}

// A route that answers never: it flags the hit, then flags the client dropping.
const hangRoute = (hit: Deferred.Deferred<void>, aborted: Deferred.Deferred<void>) => {
  const flag = (d: Deferred.Deferred<void>) => Effect.runSync(Deferred.succeed(d, undefined))
  return (req: Request) =>
    Effect.callback<Response>(() => {
      flag(hit)
      req.signal.onabort = () => flag(aborted)
    })
}

const serverSeesDrop = (open: (url: string) => Effect.Effect<Handle, Error>) =>
  Effect.gen(function* () {
    const hit = yield* Deferred.make<void>()
    const aborted = yield* Deferred.make<void>()
    const fx = yield* startFixture(() => ({ '/hang': hangRoute(hit, aborted) }))
    const handle = yield* open(`${fx.origin}/hang`)
    yield* Effect.forkScoped(io(handle.start))
    yield* Deferred.await(hit)
    yield* io(handle.cancel)
    yield* Deferred.await(aborted).pipe(Effect.timeout('3 seconds'))
  })

const scrapeHandle = (url: string) =>
  io(() => scrapeWorkflow.createRun()).pipe(
    Effect.map((run) => ({
      start: () => run.start({ inputData: { url, render: 'off' as const } }),
      cancel: () => run.cancel(),
    })),
  )

const batchHandle = (url: string) =>
  io(() => batchWorkflow.createRun()).pipe(
    Effect.map((run) => ({
      start: () => run.start({ inputData: { urls: [url] } }),
      cancel: () => run.cancel(),
    })),
  )

describe('workflow cancel reaches the network', () => {
  test('scrape', eff(serverSeesDrop(scrapeHandle)), 15_000)
  test('batch', eff(serverSeesDrop(batchHandle)), 15_000)
})
