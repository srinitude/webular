// With no cachePath, the fetch layer keeps validators in WEBULAR_CACHE_DIR, so a
// second layer (a second command run) revalidates with a 304 instead of a full GET.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { makeFetchLayer } from '../../src/lib/fetch-layer.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const page = (req: Request) =>
  req.headers.get('if-none-match') === '"v1"'
    ? new Response(null, { status: 304, headers: { etag: '"v1"' } })
    : new Response('hello', { headers: { etag: '"v1"' } })

const fetchOnce = (url: string, dir: string) =>
  Effect.scoped(Effect.flatMap(makeFetchLayer(), (fetchPage) => fetchPage(url))).pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBULAR_CACHE_DIR: dir }))),
  )

test(
  'validators outlive one fetch layer',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('fetch-validators-')
      const fx = yield* startFixture(() => ({ '/page': page }))
      const first = yield* fetchOnce(`${fx.origin}/page`, dir)
      const second = yield* fetchOnce(`${fx.origin}/page`, dir)
      expect([first.fromCache, second.fromCache, second.body]).toEqual([false, true, 'hello'])
    }),
  ),
)

test(
  'WEBULAR_NO_CACHE=1 keeps validators in memory',
  eff(
    Effect.gen(function* () {
      const fx = yield* startFixture(() => ({ '/page': page }))
      const url = `${fx.origin}/page`
      const env = ConfigProvider.fromEnvRecord({ WEBULAR_NO_CACHE: '1' })
      const once = Effect.scoped(Effect.flatMap(makeFetchLayer(), (f) => f(url)))
      const twice = Effect.andThen(once, once).pipe(Effect.provide(ConfigProvider.layer(env)))
      expect((yield* twice).fromCache).toBe(false)
    }),
  ),
)

test(
  'a page whose server fails after every retry comes back from its stored copy, marked stale',
  eff(
    Effect.gen(function* () {
      let up = true
      const fx = yield* startFixture(() => ({
        '/page': () =>
          up ? page(new Request('http://x/')) : new Response('down', { status: 503 }),
      }))
      const fetchPage = yield* makeFetchLayer({ retry: { attempts: 2, baseMs: 1, capMs: 2 } })
      const first = yield* fetchPage(`${fx.origin}/page`)
      up = false
      const second = yield* fetchPage(`${fx.origin}/page`)
      expect([first.stale, second.stale, second.body]).toEqual([undefined, true, 'hello'])
    }),
  ),
)

test(
  'ten callers asking for one page at once cost the site one request',
  eff(
    Effect.gen(function* () {
      let hits = 0
      const counted = () => {
        hits++
        return new Response('hello')
      }
      const fx = yield* startFixture(() => ({ '/page': counted }))
      const fetchPage = yield* makeFetchLayer()
      const all = yield* Effect.all(
        Array.from({ length: 10 }, () => fetchPage(`${fx.origin}/page`)),
        { concurrency: 10 },
      )
      expect([hits, all.every((r) => r.body === 'hello')]).toEqual([1, true])
    }),
  ),
)
