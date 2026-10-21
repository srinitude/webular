// FOSS download helper — wraps Bun.fetch for binary/media downloads. Streams
// to a unique `<dest>.part.<pid>.<uuid>` temp (removed on failure), then
// renames on success. The connect phase has a 30s budget; the body is
// governed by a per-chunk idle timeout so long healthy streams never die at an
// arbitrary wall clock.
import { randomUUID } from 'node:crypto'
import { rename, rm } from 'node:fs/promises'
import { Data, Effect, Exit, Schedule } from 'effect'
import { httpGet } from '../core/http.ts'
import { errMsg } from '../core/output.ts'

interface DownloadOptions {
  maxBytes?: number
  idleMs?: number
}

type Reader = ReadableStreamDefaultReader<Uint8Array>
type Writer = ReturnType<ReturnType<typeof Bun.file>['writer']>

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

// The timeout fiber is interrupted when the read settles, so fast downloads
// never pile up pending idle timers.
const readChunk = (reader: Reader, idleMs: number) =>
  attempt(() => reader.read()).pipe(
    Effect.timeoutOrElse({
      duration: idleMs,
      orElse: () => failWith(`download stalled (no data for ${idleMs}ms)`),
    }),
  )

const pump = Effect.fnUntraced(function* (
  reader: Reader,
  writer: Writer,
  maxBytes: number,
  idleMs: number,
) {
  let total = 0
  for (;;) {
    const next = yield* readChunk(reader, idleMs)
    if (next.done) return total
    total += next.value.byteLength
    if (total > maxBytes) return yield* failWith(`download exceeded max ${maxBytes} bytes`)
    writer.write(next.value)
  }
})

const discard = (reader: Reader, writer: Writer, tmp: string) =>
  Effect.all([
    Effect.ignore(attempt(() => reader.cancel())),
    Effect.ignore(attempt(() => writer.end())),
    Effect.ignore(attempt(() => rm(tmp, { force: true }))),
  ]).pipe(Effect.asVoid)

// Windows: a rename onto a dest that another rename is replacing (or a reader
// holds open) fails EPERM/EBUSY/EACCES for a moment, so retry briefly. POSIX
// renames are atomic and never hit this path.
const RENAME_BUSY = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RENAME_TRIES = 10

const renameOver = (from: string, to: string) =>
  Effect.tryPromise({
    try: () => rename(from, to),
    catch: (err) => err as NodeJS.ErrnoException,
  }).pipe(
    Effect.retry({
      while: (err) => RENAME_BUSY.has(err.code ?? ''),
      times: RENAME_TRIES - 1,
      schedule: Schedule.spaced(20),
    }),
    Effect.mapError((err) => new DownloadError({ message: errMsg(err) })),
  )

function streamToFile(
  body: ReadableStream<Uint8Array>,
  outPath: string,
  maxBytes: number,
  idleMs: number,
) {
  const tmp = `${outPath}.part.${process.pid}.${randomUUID()}`
  return Effect.acquireUseRelease(
    Effect.sync(() => ({ writer: Bun.file(tmp).writer(), reader: body.getReader() })),
    ({ reader, writer }) =>
      pump(reader, writer, maxBytes, idleMs).pipe(
        Effect.tap(() => attempt(() => writer.end())),
        Effect.tap(() => renameOver(tmp, outPath)),
      ),
    ({ reader, writer }, exit) =>
      Exit.isSuccess(exit) ? Effect.void : discard(reader, writer, tmp),
  )
}

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
  if (!res.ok) return yield* failWith(`download ${url} failed: ${res.status} ${res.statusText}`)
  if (!res.body) return yield* failWith(`download ${url} returned no body`)
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes)
    return yield* failWith(`download exceeds max ${maxBytes} bytes (declared ${declared})`)
  const bytes = yield* streamToFile(res.body, dest, maxBytes, opts.idleMs ?? DEFAULT_IDLE_MS)
  return { url, savedTo: dest, bytes }
})
