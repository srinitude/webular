// FOSS download helper — wraps Bun.fetch for binary/media downloads. Streams
// to a unique `<dest>.part.<pid>.<uuid>` temp (removed on failure), then
// renames on success. The connect phase has a 30s budget; the body is
// governed by an idle timeout that resets on each chunk, so long healthy
// streams never die at an arbitrary wall clock.
import { randomUUID } from 'node:crypto'
import { Clock, Data, Effect, FileSystem, Ref, Schedule } from 'effect'
import { httpGet } from '../core/http.ts'
import { errMsg } from '../core/output.ts'

interface DownloadOptions {
  maxBytes?: number | undefined
  idleMs?: number
}

type Reader = ReadableStreamDefaultReader<Uint8Array>

class DownloadError extends Data.TaggedError('DownloadError')<{ readonly message: string }> {}

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024
const CONNECT_TIMEOUT_MS = 30_000
const DEFAULT_IDLE_MS = 30_000

const failWith = (message: string) => Effect.fail(new DownloadError({ message }))
const attempt = <A>(run: () => PromiseLike<A> | A) =>
  Effect.tryPromise({
    try: () => Promise.resolve(run()),
    catch: (err) => new DownloadError({ message: errMsg(err) }),
  })

// One idle deadline per download, not one timer per chunk: each read stamps
// the time, and the watchdog sleeps until that stamp plus idleMs, re-arming
// only if data came in meanwhile.
const readChunk = (reader: Reader, lastChunkAt: Ref.Ref<number>) =>
  attempt(() => reader.read()).pipe(
    Effect.tap(() => Effect.flatMap(Clock.currentTimeMillis, (now) => Ref.set(lastChunkAt, now))),
  )

const idleLeft = (lastChunkAt: Ref.Ref<number>, idleMs: number) =>
  Effect.zipWith(Ref.get(lastChunkAt), Clock.currentTimeMillis, (at, now) => at + idleMs - now)

const watchdog = Effect.fnUntraced(function* (lastChunkAt: Ref.Ref<number>, idleMs: number) {
  for (;;) {
    const left = yield* idleLeft(lastChunkAt, idleMs)
    if (left <= 0) return yield* failWith(`download stalled (no data for ${idleMs}ms)`)
    yield* Effect.sleep(left)
  }
})

const copyChunks = Effect.fnUntraced(function* (
  reader: Reader,
  file: FileSystem.File,
  maxBytes: number,
  lastChunkAt: Ref.Ref<number>,
) {
  let total = 0
  for (;;) {
    const next = yield* readChunk(reader, lastChunkAt)
    if (next.done) return total
    total += next.value.byteLength
    if (total > maxBytes) return yield* failWith(`download exceeded max ${maxBytes} bytes`)
    yield* file.writeAll(next.value)
  }
})

const pump = Effect.fnUntraced(function* (
  reader: Reader,
  file: FileSystem.File,
  maxBytes: number,
  idleMs: number,
) {
  const lastChunkAt = yield* Ref.make(yield* Clock.currentTimeMillis)
  return yield* Effect.raceFirst(
    copyChunks(reader, file, maxBytes, lastChunkAt),
    watchdog(lastChunkAt, idleMs),
  )
})

// Windows: a rename onto a dest that another rename is replacing (or a reader
// holds open) fails EPERM/EBUSY/EACCES for a moment, so retry briefly. POSIX
// renames are atomic and never hit this path. FileSystem reports those codes
// as the Busy and PermissionDenied system-error tags.
const RENAME_BUSY = new Set(['Busy', 'PermissionDenied'])
const RENAME_TRIES = 10

const renameOver = (fs: FileSystem.FileSystem, from: string, to: string) =>
  fs.rename(from, to).pipe(
    Effect.retry({
      while: (err) => RENAME_BUSY.has(err.reason._tag),
      times: RENAME_TRIES - 1,
      schedule: Schedule.spaced(20),
    }),
  )

// The temp file closes with its scope before the rename; any failure or
// interrupt cancels the body and removes the temp.
const streamToFile = Effect.fnUntraced(function* (
  body: ReadableStream<Uint8Array>,
  outPath: string,
  maxBytes: number,
  idleMs: number,
) {
  const fs = yield* FileSystem.FileSystem
  const tmp = `${outPath}.part.${process.pid}.${randomUUID()}`
  const reader = body.getReader()
  return yield* Effect.scoped(
    Effect.flatMap(fs.open(tmp, { flag: 'w' }), (file) => pump(reader, file, maxBytes, idleMs)),
  ).pipe(
    Effect.tap(() => renameOver(fs, tmp, outPath)),
    Effect.onError(() =>
      Effect.andThen(
        Effect.ignore(attempt(() => reader.cancel())),
        Effect.ignore(fs.remove(tmp, { force: true })),
      ),
    ),
  )
})

export const downloadToFile = Effect.fn('downloadToFile')(function* (
  url: string,
  dest: string,
  opts: DownloadOptions = {},
) {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const res = yield* httpGet(url).pipe(
    Effect.timeoutOrElse({
      duration: CONNECT_TIMEOUT_MS,
      orElse: () => failWith(`download ${url} timed out connecting`),
    }),
  )
  // A rejected response's unread body pins its pooled connection: cancel it first.
  const reject = (message: string) =>
    Effect.andThen(Effect.ignore(attempt(() => res.body?.cancel())), failWith(message))
  if (!res.ok) return yield* reject(`download ${url} failed: ${res.status} ${res.statusText}`)
  if (!res.body) return yield* failWith(`download ${url} returned no body`)
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes)
    return yield* reject(`download exceeds max ${maxBytes} bytes (declared ${declared})`)
  const bytes = yield* streamToFile(res.body, dest, maxBytes, opts.idleMs ?? DEFAULT_IDLE_MS)
  return { url, savedTo: dest, bytes }
})
