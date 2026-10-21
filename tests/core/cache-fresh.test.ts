// Two cache contracts: a fresh max-age / Expires entry is served with no
// request at all, and a leftover `.tmp` file from a dead writer is evicted
// once stale while a young one (a live writer) is kept.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Clock, ConfigProvider, Effect, FileSystem, Layer, type Path } from 'effect'
import { cachedGetText } from '../../src/core/cache.ts'

const MINUTE = 60_000

type Services = FileSystem.FileSystem | Path.Path

const inCacheDir = <A>(body: (dir: string) => Effect.Effect<A, unknown, Services>) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-fresh-' })
        const provider = ConfigProvider.fromEnvRecord({ WEBULAR_CACHE_DIR: dir })
        return yield* body(dir).pipe(
          Effect.provide(Layer.merge(ConfigProvider.layer(provider), BunServices.layer)),
        )
      }),
    ).pipe(Effect.provide(BunServices.layer)),
  )

// A fetcher that counts requests and answers each with the given headers.
const counted = (url: string, headers: Record<string, string>) => {
  const state = { calls: 0 }
  const fetchText = cachedGetText(
    url,
    () =>
      Effect.sync(() => {
        state.calls++
        return new Response('body', { headers: { etag: '"f"', ...headers } })
      }),
    (res) => Effect.promise(() => res.text()),
  )
  return { state, fetchText }
}

const http = (ms: number) => new Date(ms).toUTCString()

// Two reads of one URL; headers are built from the clock reading at the first read.
const cases = [
  ['max-age', (_now: number) => ({ 'cache-control': 'max-age=60' }), 1],
  ['expires', (now: number) => ({ expires: http(now + MINUTE) }), 1],
  [
    'max-age-over-expires',
    (now: number) => ({ 'cache-control': 'max-age=60', expires: http(now - MINUTE) }),
    1,
  ],
  ['max-age-zero', (_now: number) => ({ 'cache-control': 'max-age=0' }), 2],
  ['no-cache', (_now: number) => ({ 'cache-control': 'max-age=60, no-cache' }), 2],
  ['past-expires', (now: number) => ({ expires: http(now - MINUTE) }), 2],
  ['no-freshness', (_now: number) => ({}), 2],
] as const

for (const [name, headersAt, expected] of cases) {
  test(`${name}: ${expected} request(s) for two reads`, () =>
    inCacheDir(() =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const { state, fetchText } = counted(`https://fresh.test/${name}`, headersAt(now))
        yield* fetchText
        expect(yield* fetchText).toBe('body')
        expect(state.calls).toBe(expected)
      }),
    ))
}

test('a stale .tmp file is evicted and a young one is kept', () =>
  inCacheDir((dir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const stale = `${dir}/dead.json.1.tmp`
      const young = `${dir}/live.json.2.tmp`
      yield* fs.writeFileString(stale, 'x')
      yield* fs.writeFileString(young, 'x')
      const hourAgo = new Date((yield* Clock.currentTimeMillis) - 60 * MINUTE)
      yield* fs.utimes(stale, hourAgo, hourAgo)
      yield* counted('https://fresh.test/tmp', {}).fetchText
      expect(yield* fs.exists(stale)).toBe(false)
      expect(yield* fs.exists(young)).toBe(true)
    }),
  ))
