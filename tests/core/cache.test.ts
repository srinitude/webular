// Disk cache contract: ETag / Last-Modified revalidation, no-store and opt-out
// bypass, oldest-last-use-first eviction under the entry and byte bounds, and
// byte-identical bodies, against a real Bun.serve server and a temp cache dir.
import { afterAll, describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, FileSystem, Layer, type Path } from 'effect'
import { cachedGetText } from '../../src/core/cache.ts'
import { httpGet } from '../../src/core/http.ts'

type Services = FileSystem.FileSystem | Path.Path

const BODY = 'héllo ✓ — cached\n'
const LAST_MODIFIED = 'Tue, 20 Oct 2026 00:00:00 GMT'
const TEXT = { 'content-type': 'text/plain; charset=utf-8' }
const NOT_MODIFIED = () => new Response(null, { status: 304 })

const route = (path: string, inm: string | null, ims: string | null): Response => {
  if (path.startsWith('/etag'))
    return inm === '"v1"'
      ? NOT_MODIFIED()
      : new Response(BODY, { headers: { ...TEXT, etag: '"v1"' } })
  if (path.startsWith('/lm'))
    return ims === LAST_MODIFIED
      ? NOT_MODIFIED()
      : new Response(BODY, { headers: { ...TEXT, 'last-modified': LAST_MODIFIED } })
  if (path.startsWith('/nostore'))
    return new Response(BODY, { headers: { ...TEXT, etag: '"n"', 'cache-control': 'no-store' } })
  if (path.startsWith('/missing'))
    return new Response('nope', { status: 404, headers: { etag: '"m"' } })
  if (path.startsWith('/plain')) return new Response(BODY, { headers: TEXT })
  if (inm === `"${path}"`) return NOT_MODIFIED()
  return new Response('x'.repeat(1000), { headers: { ...TEXT, etag: `"${path}"` } })
}

// The server records the validator headers each path received.
const startServer = () => {
  const seen = new Map<string, { inm: string | null; ims: string | null }[]>()
  const server = Bun.serve({
    port: 0,
    maxRequestBodySize: 1024,
    fetch(req) {
      const path = new URL(req.url).pathname
      const inm = req.headers.get('if-none-match')
      const ims = req.headers.get('if-modified-since')
      seen.set(path, [...(seen.get(path) ?? []), { inm, ims }])
      return route(path, inm, ims)
    },
  })
  return { server, seen }
}
const { server, seen } = startServer()
afterAll(() => server.stop(true))

const get = (path: string, opts: { cache?: boolean } = {}) => {
  const url = `http://localhost:${server.port}${path}`
  return cachedGetText(
    url,
    (headers) => httpGet(url, { headers }),
    (res) => Effect.promise(() => res.text()),
    opts,
  )
}

const withCacheDir = <A>(
  env: Record<string, string>,
  body: (dir: string) => Effect.Effect<A, unknown, Services>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-cache-' })
    const provider = ConfigProvider.fromEnvRecord({ ...env, WEBULAR_CACHE_DIR: dir })
    const services = Layer.merge(ConfigProvider.layer(provider), BunServices.layer)
    return yield* body(dir).pipe(Effect.provide(services))
  })

// Each test runs in its own scoped temp cache dir with its own env.
const run = <A>(
  env: Record<string, string>,
  body: (dir: string) => Effect.Effect<A, unknown, Services>,
) =>
  Effect.runPromise(Effect.scoped(withCacheDir(env, body)).pipe(Effect.provide(BunServices.layer)))

const entries = (dir: string) =>
  Effect.gen(function* () {
    const names = yield* (yield* FileSystem.FileSystem).readDirectory(dir)
    return names.filter((n) => n.endsWith('.json'))
  }).pipe(Effect.provide(BunServices.layer), Effect.orDie)

const hitThen304 = (dir: string) =>
  Effect.gen(function* () {
    expect(yield* get('/etag/hit')).toBe(BODY)
    expect(yield* entries(dir)).toHaveLength(1)
    expect(yield* get('/etag/hit')).toBe(BODY)
    expect(seen.get('/etag/hit')?.map((r) => r.inm)).toEqual([null, '"v1"'])
  })

const lastModified = () =>
  Effect.gen(function* () {
    yield* get('/lm')
    expect(yield* get('/lm')).toBe(BODY)
    expect(seen.get('/lm')?.[1]?.ims).toBe(LAST_MODIFIED)
  })

const byteIdentical = () =>
  Effect.gen(function* () {
    const first = Buffer.from(yield* get('/etag/bytes'))
    const second = Buffer.from(yield* get('/etag/bytes'))
    expect(first.equals(second)).toBe(true)
    expect(second.equals(Buffer.from(BODY))).toBe(true)
    expect(seen.get('/etag/bytes')).toHaveLength(2)
  })

const neverStored = (dir: string) =>
  Effect.gen(function* () {
    yield* get('/nostore')
    yield* get('/nostore')
    expect(seen.get('/nostore')?.map((r) => r.inm)).toEqual([null, null])
    yield* get('/missing')
    yield* get('/plain')
    expect(yield* entries(dir)).toHaveLength(0)
  })

const bypassed = (path: string, opts: { cache?: boolean }) => (dir: string) =>
  Effect.gen(function* () {
    yield* get(path, opts)
    yield* get(path, opts)
    expect(yield* entries(dir)).toHaveLength(0)
    expect(seen.get(path)?.map((r) => r.inm)).toEqual([null, null])
  })

// Fetch each path in order, a pause apart so file times differ.
const fetchAll = (paths: string[]) =>
  Effect.forEach(paths, (p) => Effect.andThen(get(p), Effect.sleep('20 millis')), {
    concurrency: 1,
    discard: true,
  })

const evictsOldest = (dir: string) =>
  Effect.gen(function* () {
    yield* fetchAll(['/big/a', '/big/b', '/big/c'])
    expect(yield* entries(dir)).toHaveLength(2)
    yield* fetchAll(['/big/a', '/big/c'])
    expect(seen.get('/big/a')?.[1]?.inm).toBeNull()
    expect(seen.get('/big/c')?.[1]?.inm).toBe('"/big/c"')
  })

// A 304 hit counts as a use: b leaves first, though a was written before b.
const evictsLeastUsed = (dir: string) =>
  Effect.gen(function* () {
    yield* fetchAll(['/use/a', '/use/b', '/use/a', '/use/c'])
    expect(yield* entries(dir)).toHaveLength(2)
    yield* fetchAll(['/use/a', '/use/b'])
    expect(seen.get('/use/a')?.map((r) => r.inm)).toEqual([null, '"/use/a"', '"/use/a"'])
    expect(seen.get('/use/b')?.[1]?.inm).toBeNull()
  })

describe('disk cache', () => {
  test('stores a hit, then revalidates with If-None-Match and reuses the body on 304', () =>
    run({}, hitThen304))
  test('revalidates with If-Modified-Since from a stored Last-Modified', () =>
    run({}, lastModified))
  test('repeat bodies are byte-identical to the first fetch', () => run({}, byteIdentical))
  test('stores only a 200 with a validator, never no-store', () => run({}, neverStored))
  test('cache:false bypasses the cache', () => run({}, bypassed('/etag/off', { cache: false })))
  test('WEBULAR_NO_CACHE=1 bypasses the cache', () =>
    run({ WEBULAR_NO_CACHE: '1' }, bypassed('/etag/env', {})))
  test('evicts the oldest use first to stay under the byte bound', () =>
    run({ WEBULAR_CACHE_MAX_BYTES: '2600' }, evictsOldest))
  test('evicts the oldest use first to stay under the entry bound', () =>
    run({ WEBULAR_CACHE_MAX_ENTRIES: '2' }, evictsLeastUsed))
})

// No WEBULAR_CACHE_DIR: the default folder sits under the platform cache base.
const defaultUnder = (key: string, sub: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const base = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-base-' })
    const provider = ConfigProvider.fromEnvRecord({ [key]: base })
    const services = Layer.merge(ConfigProvider.layer(provider), BunServices.layer)
    yield* get(`/etag/base-${key}`).pipe(Effect.provide(services))
    expect(yield* entries(`${base}/${sub}`)).toHaveLength(1)
  })

describe('default cache folder', () => {
  const home = process.platform === 'darwin' ? 'Library/Caches/webular' : '.cache/webular'
  const cases = [
    ['XDG_CACHE_HOME', 'webular'],
    ['LOCALAPPDATA', 'webular'],
    ['HOME', home],
    ['USERPROFILE', '.cache/webular'],
  ] as const
  for (const [key, sub] of cases) {
    test(`uses ${key} when it is the only one set`, () =>
      Effect.runPromise(
        Effect.scoped(defaultUnder(key, sub)).pipe(Effect.provide(BunServices.layer)),
      ))
  }
})
