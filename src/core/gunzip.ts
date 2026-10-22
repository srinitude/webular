// Gzip sitemaps (.xml.gz, or gzip bytes under any name): the body is sniffed for
// the gzip magic bytes and, when present, streamed through DecompressionStream, so
// the byte cap in decode.ts counts DECOMPRESSED bytes and aborts a gzip bomb early.
import { Effect } from 'effect'
import { FetchError } from './decode.ts'
import { errMsg } from './output.ts'

const GZIP_TYPES = new Set(['application/gzip', 'application/x-gzip'])

// The first chunk is read to sniff, then replayed ahead of the rest of the body.
const replayed = (reader: ReadableStreamDefaultReader<Uint8Array>, first: Uint8Array | undefined) =>
  new ReadableStream<Uint8Array>({
    start(ctl) {
      if (first) ctl.enqueue(first)
    },
    async pull(ctl) {
      const next = await reader.read()
      if (next.done) ctl.close()
      else ctl.enqueue(next.value)
    },
    cancel: (reason) => reader.cancel(reason),
  })

// A body gzipped twice is peeled layer by layer; the cap in decode.ts still counts the final bytes.
const MAX_GZIP_LAYERS = 3

// Same status and headers; the body is decompressed while it starts with gzip magic.
// A gzip content-type becomes application/xml either way, so the text guard accepts it.
export const gunzipResponse = Effect.fn('gunzipResponse')(function* (res: Response) {
  if (!res.body) return res
  let reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader()
  let layers = 0
  let body: ReadableStream<Uint8Array>
  while (true) {
    const r = reader
    const head = yield* Effect.tryPromise({
      try: () => r.read(),
      catch: (err) => new FetchError({ message: errMsg(err) }),
    })
    const first = head.done ? undefined : head.value
    body = replayed(reader, first)
    if (!(first?.[0] === 0x1f && first[1] === 0x8b) || layers === MAX_GZIP_LAYERS) break
    body = body.pipeThrough(
      new DecompressionStream('gzip') as ReadableWritablePair<Uint8Array<ArrayBuffer>, Uint8Array>,
    )
    reader = body.getReader()
    layers++
  }
  const headers = new Headers(res.headers)
  if (layers > 0) headers.delete('content-length')
  const type = (headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (GZIP_TYPES.has(type)) headers.set('content-type', 'application/xml')
  return new Response(body, { status: res.status, statusText: res.statusText, headers })
})
