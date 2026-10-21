// Bounded disk cache for text GETs: ETag / Last-Modified revalidation,
// atomic temp-then-rename writes, oldest-write-first eviction under a byte
// bound. Cache I/O failures never fail the fetch: they only skip the cache.
import { BunServices } from '@effect/platform-bun'
import { Config, Effect, FileSystem, ManagedRuntime, Option, Path, Random, Schema } from 'effect'

export interface CacheOptions {
  cache?: boolean
}

const Entry = Schema.Struct({
  body: Schema.String,
  etag: Schema.NullOr(Schema.String),
  lastModified: Schema.NullOr(Schema.String),
  contentType: Schema.NullOr(Schema.String),
})
type Entry = typeof Entry.Type
const decodeEntry = Schema.decodeUnknownEffect(Schema.fromJsonString(Entry))

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024

const settings = Effect.gen(function* () {
  const path = yield* Path.Path
  // Windows has no HOME: LOCALAPPDATA, then USERPROFILE, then HOME.
  const home = yield* Config.String('LOCALAPPDATA').pipe(
    Config.orElse(() => Config.String('USERPROFILE')),
    Config.orElse(() => Config.String('HOME')),
    Config.withDefault('.'),
  )
  const dir = yield* Config.String('WEBULAR_CACHE_DIR').pipe(
    Config.withDefault(path.join(home, '.cache', 'webular')),
  )
  const maxBytes = yield* Config.Int('WEBULAR_CACHE_MAX_BYTES').pipe(
    Config.withDefault(DEFAULT_MAX_BYTES),
  )
  const off = yield* Config.String('WEBULAR_NO_CACHE').pipe(Config.withDefault(''))
  return { dir, maxBytes, off: off === '1' }
})

const keyOf = (method: string, url: string) =>
  new Bun.CryptoHasher('sha256').update(`${method}${url}`).digest('hex')

const load = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return yield* decodeEntry(yield* fs.readFileString(file))
  }).pipe(Effect.option)

const validators = (entry: Option.Option<Entry>): Record<string, string> => {
  if (Option.isNone(entry)) return {}
  const { etag, lastModified } = entry.value
  return {
    ...(etag ? { 'if-none-match': etag } : {}),
    ...(lastModified ? { 'if-modified-since': lastModified } : {}),
  }
}

const storable = (res: Response) =>
  res.ok && !/\bno-store\b/i.test(res.headers.get('cache-control') ?? '')

const entryInfo = (file: string) =>
  Effect.gen(function* () {
    const info = yield* (yield* FileSystem.FileSystem).stat(file)
    const mtime = Option.match(info.mtime, { onNone: () => 0, onSome: (d) => d.getTime() })
    return { file, size: Number(info.size), mtime }
  })

// Delete the oldest-written entries until the total fits under the bound.
const evict = (dir: string, maxBytes: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const names = (yield* fs.readDirectory(dir)).filter((n) => n.endsWith('.json'))
    const files = yield* Effect.forEach(names, (n) => entryInfo(path.join(dir, n)), {
      concurrency: 8,
    })
    files.sort((a, b) => a.mtime - b.mtime)
    let total = files.reduce((sum, f) => sum + f.size, 0)
    for (const f of files) {
      if (total <= maxBytes) break
      yield* fs.remove(f.file, { force: true })
      total -= f.size
    }
  })

const store = (dir: string, file: string, entry: Entry, maxBytes: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(dir, { recursive: true })
    const tmp = `${file}.${yield* Random.nextInt}.tmp`
    yield* fs.writeFileString(tmp, JSON.stringify(entry))
    yield* fs.rename(tmp, file)
    yield* evict(dir, maxBytes)
  }).pipe(Effect.ignore)

const attempt = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: (err) => err })

const toEntry = (body: string, h: Headers): Entry => ({
  body,
  etag: h.get('etag'),
  lastModified: h.get('last-modified'),
  contentType: h.get('content-type'),
})

// GET text through the disk cache. `get` performs the request with the extra
// validator headers; `read` turns a response into text (and rejects bad ones).
export const cachedGetTextEffect = Effect.fn('cachedGetText')(function* (
  url: string,
  get: (headers: Record<string, string>) => Promise<Response>,
  read: (res: Response) => Promise<string>,
  opts: CacheOptions = {},
) {
  const { dir, maxBytes, off } = yield* settings
  const bypass = off || opts.cache === false
  const file = (yield* Path.Path).join(dir, `${keyOf('GET', url)}.json`)
  const entry = bypass ? Option.none<Entry>() : yield* load(file)
  const res = yield* attempt(() => get(validators(entry)))
  const stream = res.body
  if (res.status === 304 && Option.isSome(entry)) {
    if (stream) yield* attempt(() => stream.cancel()).pipe(Effect.ignore)
    return entry.value.body
  }
  const body = yield* attempt(() => read(res))
  if (!bypass && storable(res)) yield* store(dir, file, toEntry(body, res.headers), maxBytes)
  return body
})

// ponytail: owns only stateless Bun services, so it is never disposed.
const runtime = ManagedRuntime.make(BunServices.layer)

// Promise boundary for the not-yet-Effect fetch layer.
export const cachedGetText = (
  url: string,
  get: (headers: Record<string, string>) => Promise<Response>,
  read: (res: Response) => Promise<string>,
  opts: CacheOptions = {},
): Promise<string> => runtime.runPromise(cachedGetTextEffect(url, get, read, opts))
