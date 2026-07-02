// Bytes → text: charset detection (BOM > Content-Type > meta prescan > utf-8)
// and a streaming, byte-capped decode — no whole-body double buffering.
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

function metaCharset(prefix: Uint8Array): string | null {
  const head = new TextDecoder('latin1').decode(prefix)
  const m = /<meta\s[^>]*charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(head)
  return m?.[1] ?? null
}

export function pickCharset(contentType: string | null, prefix: Uint8Array): string {
  return bomCharset(prefix) ?? headerCharset(contentType) ?? metaCharset(prefix) ?? 'utf-8'
}

// Labels Bun's TextDecoder does not support fall back to utf-8 — deterministic
// under the pinned runtime.
function makeDecoder(label: string): TextDecoder {
  try {
    return new TextDecoder(label)
  } catch {
    return new TextDecoder()
  }
}

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

// Read a response body as text with a hard byte cap. The charset is chosen
// from the first ≤1024 bytes (HTML5 prescan window) before any decoding.
export async function readTextCapped(
  res: Response,
  url: string,
  maxBytes: number,
): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new Error(`fetch ${url}: response too large (${declared} bytes)`)
  if (!res.body) return ''
  const contentType = res.headers.get('content-type')
  const state: DecodeState = { prefix: [], prefixBytes: 0, decoder: null, text: '' }
  let total = 0
  for await (const chunk of res.body as ReadableStream<Uint8Array>) {
    total += chunk.byteLength
    if (total > maxBytes) throw new Error(`fetch ${url}: response exceeded ${maxBytes} bytes`)
    feed(state, chunk, contentType)
  }
  if (!state.decoder) beginDecode(state, contentType)
  return state.text + (state.decoder ?? new TextDecoder()).decode()
}
