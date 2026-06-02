// FOSS download helper — wraps Bun.fetch for binary/media downloads.
// Streams to disk with a byte cap; returns bytes written and the save path.
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { httpGet } from '../core/http.ts'

export interface DownloadResult {
  url: string
  savedTo: string
  bytes: number
}

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024

function tempPath(): string {
  return join(tmpdir(), `webular-media-${randomUUID()}`)
}

async function streamToFile(res: Response, outPath: string, maxBytes: number): Promise<number> {
  const writer = Bun.file(outPath).writer()
  let total = 0
  for await (const chunk of res.body as ReadableStream<Uint8Array>) {
    total += chunk.byteLength
    if (total > maxBytes) {
      await writer.end()
      throw new Error(`download exceeded max ${maxBytes} bytes`)
    }
    writer.write(chunk)
  }
  await writer.end()
  return total
}

export async function downloadToFile(
  url: string,
  dest?: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<DownloadResult> {
  const res = await httpGet(url)
  if (!res.ok) throw new Error(`download ${url} failed: ${res.status} ${res.statusText}`)
  if (!res.body) throw new Error(`download ${url} returned no body`)
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > maxBytes)
    throw new Error(`download exceeds max ${maxBytes} bytes (declared ${declared})`)
  const outPath = dest ?? tempPath()
  return { url, savedTo: outPath, bytes: await streamToFile(res, outPath, maxBytes) }
}
