// Disk cache eviction is deterministic: entries with the same last-use time
// leave in file-name order, never in the file system's directory order.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, FileSystem, Path } from 'effect'
import { cachedGetText } from '../../src/core/cache.ts'
import { httpGet } from '../../src/core/http.ts'

const TIED = 12

const server = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      maxRequestBodySize: 1024,
      fetch: (req) => new Response('x', { headers: { etag: `"${new URL(req.url).pathname}"` } }),
    }),
  ),
  (s) => Effect.promise(() => s.stop(true)),
)

const jsonNames = (fs: FileSystem.FileSystem, dir: string) =>
  Effect.map(fs.readDirectory(dir), (n) => n.filter((f) => f.endsWith('.json')).sort())

const tieEvictsFirstName = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const port = (yield* server).port
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-cache-tie-' })
  const env = { WEBULAR_CACHE_DIR: dir, WEBULAR_CACHE_MAX_ENTRIES: String(TIED) }
  const get = (p: string) => {
    const url = `http://localhost:${port}${p}`
    return cachedGetText(
      url,
      (headers) => httpGet(url, { headers }),
      (res) => Effect.promise(() => res.text()),
      {},
    ).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))))
  }
  const paths = Array.from({ length: TIED }, (_, i) => `/tie/${i}`)
  yield* Effect.forEach(paths, get, { concurrency: 1, discard: true })
  const tied = yield* jsonNames(fs, dir)
  const past = new Date(0)
  yield* Effect.forEach(tied, (n) => fs.utimes(path.join(dir, n), past, past), {
    concurrency: 4,
    discard: true,
  })
  yield* get('/tie/new')
  const left = yield* jsonNames(fs, dir)
  expect(left).toHaveLength(TIED)
  expect(left).not.toContain(tied[0])
  expect(tied.slice(1).every((n) => left.includes(n))).toBe(true)
})

test(
  'entries tied on last use are evicted in file-name order',
  () =>
    Effect.runPromise(Effect.scoped(tieEvictsFirstName).pipe(Effect.provide(BunServices.layer))),
  30_000,
)
