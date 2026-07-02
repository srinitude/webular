// FOSS download helper — wraps Bun.fetch for binary/media downloads. Streams
// to a fixed `<dest>.part` temp (overwritten on retry, removed on failure),
// then renames on success. The connect phase has a 30s budget; the body is
// governed by a per-chunk idle timer so long healthy streams never die at an
// arbitrary wall clock (B5).
import { rename, rm } from 'node:fs/promises'
import { httpGet } from '../core/http.ts'

interface DownloadResult {
  url: string
  savedTo: string
  bytes: number
}

interface DownloadOptions {
  maxBytes?: number
  idleMs?: number
}

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024
const CONNECT_TIMEOUT_MS = 30_000
const DEFAULT_IDLE_MS = 30_000
const IDLE: unique symbol = Symbol('idle')

// Race one read against a CANCELLED-on-settle timer — a bare Bun.sleep per
// chunk would leave thousands of pending 30s timers on fast downloads.
async function readWithIdle(reader: ReadableStreamDefaultReader<Uint8Array>, idleMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const idle = new Promise<typeof IDLE>((resolveIdle) => {
    timer = setTimeout(() => resolveIdle(IDLE), idleMs)
  })
  try {
    return await Promise.race([reader.read(), idle])
  } finally {
    clearTimeout(timer)
  }
}

async function pump(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: { write(c: Uint8Array): unknown },
  maxBytes: number,
  idleMs: number,
): Promise<number> {
  let total = 0
  for (;;) {
    const next = await readWithIdle(reader, idleMs)
    if (next === IDLE) throw new Error(`download stalled (no data for ${idleMs}ms)`)
    if (next.done) return total
    total += next.value.byteLength
    if (total > maxBytes) throw new Error(`download exceeded max ${maxBytes} bytes`)
    writer.write(next.value)
  }
}

// pid + counter keep concurrent downloads to ONE dest (in-process or across
// processes) on separate temps; the suffix never reaches output (savedTo=dest).
let tempSeq = 0

async function streamToFile(
  body: ReadableStream<Uint8Array>,
  outPath: string,
  maxBytes: number,
  idleMs: number,
): Promise<number> {
  tempSeq += 1
  const tmp = `${outPath}.part.${process.pid}.${tempSeq}`
  const writer = Bun.file(tmp).writer()
  const reader = body.getReader()
  try {
    const total = await pump(reader, writer, maxBytes, idleMs)
    await writer.end()
    await rename(tmp, outPath)
    return total
  } catch (err) {
    await reader.cancel().catch(() => {})
    await writer.end()
    await rm(tmp, { force: true })
    throw err
  }
}

export async function downloadToFile(
  url: string,
  dest: string,
  opts: DownloadOptions = {},
): Promise<DownloadResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const connect = new AbortController()
  const timer = setTimeout(() => connect.abort(), CONNECT_TIMEOUT_MS)
  let res: Response
  try {
    res = await httpGet(url, { signal: connect.signal })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`download ${url} failed: ${res.status} ${res.statusText}`)
  if (!res.body) throw new Error(`download ${url} returned no body`)
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new Error(`download exceeds max ${maxBytes} bytes (declared ${declared})`)
  const bytes = await streamToFile(res.body, dest, maxBytes, opts.idleMs ?? DEFAULT_IDLE_MS)
  return { url, savedTo: dest, bytes }
}
