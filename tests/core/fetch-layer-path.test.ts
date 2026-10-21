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
