// Bytes → text: charset detection (BOM > Content-Type > meta prescan > utf-8)
// and a streaming, byte-capped decode — no whole-body double buffering.
import { Data, Effect, Option, Stream } from 'effect'
import { errMsg } from './output.ts'

export class FetchError extends Data.TaggedError('FetchError')<{
  readonly message: string
  readonly aborted?: boolean
}> {}

const PRESCAN_BYTES = 1024

interface DecodeState {
  prefix: Uint8Array[]
  prefixBytes: number
  decoder: TextDecoder | null
  text: string
}

function bomCharset(prefix: Uint8Array): string | null {
  if (prefix[0] === 0xef && prefix[1] === 0xbb && prefix[2] === 0xbf) return 'utf-8'
  if (prefix[0] === 0xff && prefix[1] === 0xfe) return 'utf-16le'
  if (prefix[0] === 0xfe && prefix[1] === 0xff) return 'utf-16be'
  return null
}

function headerCharset(contentType: string | null): string | null {
  const m = /charset=["']?([\w.:-]+)/i.exec(contentType ?? '')
  return m?.[1] ?? null
}

// Labels Bun's TextDecoder does not support fall back to utf-8 — deterministic
// under the pinned runtime.
const decoderFor = Option.liftThrowable((label: string) => new TextDecoder(label))

// The canonical encoding name for a label, or null when it is unknown, so an
// unknown label falls through to the next source (WHATWG).
const known = (label: string | null): string | null =>
  label === null ? null : Option.getOrNull(Option.map(decoderFor(label), (d) => d.encoding))

// Only the first 1024 bytes are prescanned; a meta utf-16 label means utf-8
// and x-user-defined means windows-1252 (WHATWG prescan rules).
function metaCharset(prefix: Uint8Array): string | null {
  const head = new TextDecoder('latin1').decode(prefix.subarray(0, PRESCAN_BYTES))
  const m = /<meta\s[^>]*charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(head)
  const enc = known(m?.[1] ?? null)
  if (enc?.startsWith('utf-16')) return 'utf-8'
  return enc === 'x-user-defined' ? 'windows-1252' : enc
}

export function pickCharset(contentType: string | null, prefix: Uint8Array): string {
  return bomCharset(prefix) ?? known(headerCharset(contentType)) ?? metaCharset(prefix) ?? 'utf-8'
}

const makeDecoder = (label: string): TextDecoder =>
  Option.getOrElse(decoderFor(label), () => new TextDecoder())

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function beginDecode(state: DecodeState, contentType: string | null): void {
  const joined = concat(state.prefix)
  state.decoder = makeDecoder(pickCharset(contentType, joined))
  state.text = state.decoder.decode(joined, { stream: true })
  state.prefix = []
}

function feed(state: DecodeState, chunk: Uint8Array, contentType: string | null): void {
  if (state.decoder) {
    state.text += state.decoder.decode(chunk, { stream: true })
    return
  }
  state.prefix.push(chunk)
  state.prefixBytes += chunk.byteLength
  if (state.prefixBytes >= PRESCAN_BYTES) beginDecode(state, contentType)
}

function finish(state: DecodeState, contentType: string | null): string {
  if (!state.decoder) beginDecode(state, contentType)
  return state.text + (state.decoder ?? new TextDecoder()).decode()
}

const fetchError = (message: string) => new FetchError({ message })

// Read a response body as text with a hard byte cap. The charset is chosen
// from the first ≤1024 bytes (HTML5 prescan window) before any decoding.
export function readTextCapped(
  res: Response,
  url: string,
  maxBytes: number,
): Effect.Effect<string, FetchError> {
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes)
    return Effect.fail(fetchError(`fetch ${url}: response too large (${declared} bytes)`))
  const body = res.body
  if (!body) return Effect.succeed('')
  const contentType = res.headers.get('content-type')
  const state: DecodeState = { prefix: [], prefixBytes: 0, decoder: null, text: '' }
  const chunks = Stream.fromReadableStream({
    evaluate: () => body as ReadableStream<Uint8Array>,
    onError: (err) => fetchError(`fetch ${url}: ${errMsg(err)}`),
  })
  return Stream.runFoldEffect(
    chunks,
    () => 0,
    (total, chunk) => {
      const next = total + chunk.byteLength
      if (next > maxBytes)
        return Effect.fail(fetchError(`fetch ${url}: response exceeded ${maxBytes} bytes`))
      return Effect.sync(() => {
        feed(state, chunk, contentType)
        return next
      })
    },
  ).pipe(Effect.map(() => finish(state, contentType)))
}
