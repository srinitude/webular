// Bounded disk cache for text GETs: ETag / Last-Modified revalidation,
// max-age / Expires freshness (a fresh entry makes no request), atomic
// temp-then-rename writes, oldest-last-use-first eviction under an entry and a
// byte bound, and removal of stale temp files. Cache I/O failures never fail
// the fetch: they only skip the cache.

import { Clock, Config, Effect, FileSystem, Option, Path, Random, Schema } from 'effect'
import { Entry, freshen, toEntry } from './cache-entry.ts'

export interface CacheOptions {
  cache?: boolean
}

const decodeEntry = Schema.decodeUnknownEffect(Schema.fromJsonString(Entry))

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024
const DEFAULT_MAX_ENTRIES = 4096
// A live write holds its temp file for milliseconds; an older one is a dead writer's.
const STALE_TMP_MS = 10 * 60 * 1000

interface Limits {
  bytes: number
  entries: number
}

// The platform cache folder: XDG_CACHE_HOME, then %LOCALAPPDATA% (Windows),
// then ~/Library/Caches on macOS or ~/.cache elsewhere, then USERPROFILE.
const platformCacheBase = (path: Path.Path) => {
  const home = process.platform === 'darwin' ? ['Library', 'Caches'] : ['.cache']
  return Config.String('XDG_CACHE_HOME').pipe(
    Config.orElse(() => Config.String('LOCALAPPDATA')),
    Config.orElse(() => Config.map(Config.String('HOME'), (h) => path.join(h, ...home))),
    Config.orElse(() => Config.map(Config.String('USERPROFILE'), (h) => path.join(h, '.cache'))),
    Config.withDefault('.cache'),
  )
}

const settings = Effect.gen(function* () {
  const path = yield* Path.Path
  const base = yield* platformCacheBase(path)
  const dir = yield* Config.String('WEBULAR_CACHE_DIR').pipe(
    Config.withDefault(path.join(base, 'webular')),
  )
  const bytes = yield* Config.Int('WEBULAR_CACHE_MAX_BYTES').pipe(
    Config.withDefault(DEFAULT_MAX_BYTES),
  )
  const entries = yield* Config.Int('WEBULAR_CACHE_MAX_ENTRIES').pipe(
    Config.withDefault(DEFAULT_MAX_ENTRIES),
  )
  const off = yield* Config.String('WEBULAR_NO_CACHE').pipe(Config.withDefault(''))
  return { dir, limits: { bytes, entries } satisfies Limits, off: off === '1' }
})

const keyOf = (url: string) => new Bun.CryptoHasher('sha256').update(url).digest('hex')

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

// Only a 200 with a validator can be revalidated later; no-store is never kept.
const storable = (res: Response) =>
  res.status === 200 &&
  (res.headers.has('etag') || res.headers.has('last-modified')) &&
  !/\bno-store\b/i.test(res.headers.get('cache-control') ?? '')

const entryInfo = (file: string) =>
  Effect.gen(function* () {
    const info = yield* (yield* FileSystem.FileSystem).stat(file)
    const mtime = Option.match(info.mtime, { onNone: () => 0, onSome: (d) => d.getTime() })
    return { file, size: Number(info.size), mtime }
  })

// Temp files from a dead writer never reach `.json`; sweep the old ones. A stat
// or remove that fails (a live writer renamed it first) is not an error.
const sweepTmp = (dir: string, names: string[], now: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* Effect.forEach(
      names.filter((n) => n.endsWith('.tmp')),
      (n) =>
        entryInfo(path.join(dir, n)).pipe(
          Effect.flatMap((f) =>
            now - f.mtime > STALE_TMP_MS ? fs.remove(f.file, { force: true }) : Effect.void,
          ),
          Effect.ignore,
        ),
      { concurrency: 8, discard: true },
    )
  })

// mtime is the last use: a write or a 304 hit sets it, so the oldest goes first.
const evict = (dir: string, max: Limits) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const all = yield* fs.readDirectory(dir)
    yield* sweepTmp(dir, all, yield* Clock.currentTimeMillis)
    const names = all.filter((n) => n.endsWith('.json'))
    const files = yield* Effect.forEach(names, (n) => entryInfo(path.join(dir, n)), {
      concurrency: 8,
    })
    // Ties leave in name order, not the file system's directory order.
    files.sort((a, b) => a.mtime - b.mtime || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    let total = files.reduce((sum, f) => sum + f.size, 0)
    let count = files.length
    for (const f of files) {
      if (total <= max.bytes && count <= max.entries) break
      yield* fs.remove(f.file, { force: true })
      total -= f.size
      count--
    }
  })

const store = (dir: string, file: string, entry: Entry, max: Limits) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(dir, { recursive: true })
    const tmp = `${file}.${yield* Random.nextInt}.tmp`
    yield* fs.writeFileString(tmp, JSON.stringify(entry))
    yield* fs.rename(tmp, file)
    yield* evict(dir, max)
  }).pipe(Effect.ignore)

// A 304 hit marks the entry as used, so eviction keeps it longer.
const touch = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    // A Date, not a number: Node reads a bare number as seconds, and NTFS refuses the result.
    const now = new Date(yield* Clock.currentTimeMillis)
    yield* fs.utimes(file, now, now)
  }).pipe(Effect.ignore)

// GET text through the disk cache. `get` performs the request with the extra
// validator headers; `read` turns a response into text (and rejects bad ones).
export const cachedGetText = Effect.fn('cachedGetText')(function* <E>(
  url: string,
  get: (headers: Record<string, string>) => Effect.Effect<Response, E>,
  read: (res: Response) => Effect.Effect<string, E>,
  opts: CacheOptions = {},
) {
  const { dir, limits, off } = yield* settings
  const bypass = off || opts.cache === false
  const file = (yield* Path.Path).join(dir, `${keyOf(url)}.json`)
  const entry = bypass ? Option.none<Entry>() : yield* load(file)
  const now = yield* Clock.currentTimeMillis
  if (Option.isSome(entry) && (entry.value.freshUntil ?? 0) > now) {
    yield* touch(file)
    return entry.value.body
  }
  const res = yield* get(validators(entry))
  const stream = res.body
  if (res.status === 304 && Option.isSome(entry)) {
    if (stream) yield* Effect.ignore(Effect.tryPromise(() => stream.cancel()))
    yield* store(dir, file, freshen(entry.value, res.headers, now), limits)
    return entry.value.body
  }
  const body = yield* read(res)
  if (!bypass && storable(res)) yield* store(dir, file, toEntry(body, res.headers, now), limits)
  return body
})
