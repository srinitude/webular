// Monitor job adapters. Firecrawl: two POST /v2/scrape calls with the
// changeTracking git-diff format; the second reports the change. webular: its
// monitor workflow run twice against one scratch snapshot database. Both
// return {changeStatus, diff?} as JSON text for the regex check.
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import type { BenchError, Output, Provider } from './model.ts'
import { fail, type Post } from './peers.ts'

// Firecrawl scrape: 1 credit at $83 / 100,000; changeTracking adds 1 per call
// (unverified), so two calls cost 4 credits.
const FIRECRAWL_MONITOR_USD = (4 * 83) / 100_000

type Jobs = Provider['jobs']

export const MonitorOut = Schema.Struct({
  changeStatus: Schema.String,
  diff: Schema.optionalKey(Schema.String),
})
type MonitorOut = typeof MonitorOut.Type

const FcTracked = Schema.Struct({
  data: Schema.Struct({
    changeTracking: Schema.Struct({
      changeStatus: Schema.String,
      diff: Schema.optionalKey(Schema.Struct({ text: Schema.String })),
    }),
  }),
})

const monitored = (r: MonitorOut, url: string, costUsd: number, sentBytes: number): Output => ({
  text: JSON.stringify({ changeStatus: r.changeStatus, diff: r.diff }),
  urls: [url],
  citations: [],
  costUsd,
  sentBytes,
})

export const firecrawlMonitor = (post: Post, key: string): Jobs => ({
  monitor: ({ url = '' }) => {
    const scrape = () =>
      post(
        'https://api.firecrawl.dev/v2/scrape',
        { authorization: `Bearer ${key}` },
        { url, formats: [{ type: 'changeTracking', modes: ['git-diff'] }] },
        FcTracked,
      )
    return scrape().pipe(
      Effect.flatMap((first) =>
        scrape().pipe(
          Effect.map((second) => {
            const t = second.r.data.changeTracking
            return monitored(
              { changeStatus: t.changeStatus, ...(t.diff && { diff: t.diff.text }) },
              url,
              FIRECRAWL_MONITOR_USD,
              first.sentBytes + second.sentBytes,
            )
          }),
        ),
      ),
    )
  },
})

type Run = (input: { url: string; dbPath: string }) => Effect.Effect<MonitorOut, BenchError>

// The first run stores the snapshot ("new"); the second reads the changed page.
export const webularMonitor = (run: Run): Jobs => ({
  monitor: ({ url = '' }) =>
    Effect.scoped(
      Effect.gen(function* () {
        const dir = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped()
        const dbPath = `${dir}/monitor.db`
        yield* run({ url, dbPath })
        return monitored(yield* run({ url, dbPath }), url, 0, 0)
      }),
    ).pipe(Effect.provide(BunServices.layer), Effect.mapError(fail)),
})
