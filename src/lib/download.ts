// FOSS download helper — wraps Bun.fetch for binary/media downloads.
// Returns bytes written and the path the data was saved to.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { httpGet } from '../core/http.ts'

export interface DownloadResult {
  url: string
  savedTo: string
  bytes: number
}

function tempPath(url: string): string {
  const name = url.split('/').pop()?.split('?')[0] || 'download'
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
  return join(tmpdir(), `webular-media-${Date.now()}-${safe}`)
}

export async function downloadToFile(url: string, dest?: string): Promise<DownloadResult> {
  const res = await httpGet(url)
  if (!res.ok) throw new Error(`download ${url} failed: ${res.status} ${res.statusText}`)
  const outPath = dest ?? tempPath(url)
  const buf = await res.arrayBuffer()
  await Bun.write(outPath, buf)
  return { url, savedTo: outPath, bytes: buf.byteLength }
}
