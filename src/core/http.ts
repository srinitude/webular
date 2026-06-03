// FOSS fetch layer built on Bun.fetch (proxy, timeout, user-agent, redirects).
import pkg from '../../package.json' with { type: 'json' }

const USER_AGENT = `webular/${pkg.version} (+https://github.com/srinitude/webular)`
const MAX_TEXT_BYTES = 25 * 1024 * 1024

export interface FetchOptions {
  timeoutMs?: number
  headers?: Record<string, string>
  proxy?: string
  redirect?: RequestRedirect
}

export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 30_000)
  const init: RequestInit & { proxy?: string } = {
    headers: { 'user-agent': USER_AGENT, ...opts.headers },
    redirect: opts.redirect ?? 'follow',
    signal,
  }
  if (opts.proxy) init.proxy = opts.proxy
  return await fetch(url, init)
}

// Read a response body as text with a hard byte cap (rejects oversized or
// chunked-unbounded responses) — protects every text fetch from OOM.
async function readCapped(res: Response, url: string): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > MAX_TEXT_BYTES)
    throw new Error(`fetch ${url}: response too large (${declared} bytes)`)
  if (!res.body) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of res.body as ReadableStream<Uint8Array>) {
    total += chunk.byteLength
    if (total > MAX_TEXT_BYTES)
      throw new Error(`fetch ${url}: response exceeded ${MAX_TEXT_BYTES} bytes`)
    chunks.push(chunk)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

async function okText(res: Response, url: string): Promise<string> {
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`)
  return readCapped(res, url)
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return okText(await httpGet(url, opts), url)
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}

// Same registrable site (apex-based): allows apex<->www and subdomains of the
// same domain, but blocks other domains and internal IPs (SSRF stays closed).
function sameSite(allowed: string, candidate: string): boolean {
  if (allowed === candidate) return true
  const apex = (h: string): string => h.split('.').slice(-2).join('.')
  return apex(allowed) === apex(candidate)
}

// Fetch text but follow redirects MANUALLY, blocking any hop that leaves `host`.
// Used by scoped crawls so a same-host page cannot redirect off-scope (SSRF).
export async function fetchTextWithinHost(
  url: string,
  host: string,
  opts: FetchOptions = {},
): Promise<string> {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    const res = await httpGet(current, { ...opts, redirect: 'manual' })
    if (!isRedirect(res.status)) return okText(res, current)
    const location = res.headers.get('location')
    if (!location) return okText(res, current)
    current = new URL(location, current).toString()
    if (!sameSite(host, new URL(current).hostname))
      throw new Error(`redirect off-site blocked: ${current}`)
  }
  throw new Error(`too many redirects: ${url}`)
}
