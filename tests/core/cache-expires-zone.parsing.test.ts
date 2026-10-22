// An Expires header with no time zone is GMT, not local time: the same entry
// is fresh or stale the same way on every machine (run under TZ=UTC,
// America/New_York, and Asia/Kolkata).
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Clock, ConfigProvider, Effect, FileSystem } from 'effect'
import { cachedGetText } from '../../src/core/cache.ts'

const MINUTE = 60_000
// "Wed, 21 Oct 2026 22:30:00": an HTTP date with its zone cut off.
const zoneless = (ms: number) => new Date(ms).toUTCString().replace(' GMT', '')

const requestsForTwoReads = (name: string, expires: (now: number) => string) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-expires-' })
        const now = yield* Clock.currentTimeMillis
        let calls = 0
        const fetchText = cachedGetText(
          `https://expires-zone.test/${name}`,
          () =>
            Effect.sync(() => {
              calls++
              return new Response('body', { headers: { etag: '"z"', expires: expires(now) } })
            }),
          (res) => Effect.promise(() => res.text()),
        ).pipe(
          Effect.provide(
            ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBULAR_CACHE_DIR: dir })),
          ),
        )
        yield* fetchText
        yield* fetchText
        return calls
      }),
    ).pipe(Effect.provide(BunServices.layer)),
  )

test('a zoneless Expires a minute ahead is fresh: one request for two reads', async () => {
  expect(await requestsForTwoReads('ahead', (now) => zoneless(now + MINUTE))).toBe(1)
})

test('a zoneless Expires a minute ago is stale: two requests for two reads', async () => {
  expect(await requestsForTwoReads('past', (now) => zoneless(now - MINUTE))).toBe(2)
})
