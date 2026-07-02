// FOSS fetch layer built on Bun.fetch: timeout, user-agent, scoped redirects,
// textual-content guard, and deterministic bounded retry.
import pkg from '../../package.json' with { type: 'json' }
import { readTextCapped } from './decode.ts'
import { sameHost } from './url.ts'

const USER_AGENT = `webular/${pkg.version} (+https://github.com/srinitude/webular)`
const MAX_TEXT_BYTES = 25 * 1024 * 1024

// MIME types accepted by text fetches; anything else errors instead of
// decoding binary bytes into garbage markdown.
const TEXTUAL_MIMES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/xhtml+xml',
])

// Deterministic retry policy: fixed backoff (no jitter), fixed attempt count.
const RETRY_BACKOFF_MS = [250, 750]
const RETRY_STATUS = new Set([429, 502, 503, 504])

interface FetchOptions {
  timeoutMs?: number
  headers?: Record<string, string>
  signal?: AbortSignal
  redirect?: RequestRedirect
}

async function fetchOnce(url: string, opts: FetchOptions): Promise<Response> {
  return await fetch(url, {
    headers: { 'user-agent': USER_AGENT, ...opts.headers },
    redirect: opts.redirect ?? 'follow',
    // A fresh per-attempt budget unless the caller owns the signal lifecycle.
    signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  })
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')
}

type Attempt =
  | { kind: 'response'; res: Response }
  | { kind: 'retry' }
  | { kind: 'raise'; err: unknown }

async function attemptGet(url: string, opts: FetchOptions, last: boolean): Promise<Attempt> {
  try {
    const res = await fetchOnce(url, opts)
    if (!RETRY_STATUS.has(res.status) || last) return { kind: 'response', res }
    await res.body?.cancel()
    return { kind: 'retry' }
  } catch (err) {
    // A timeout/abort is the caller's budget — retrying would silently exceed it.
    if (isAbort(err) || last) return { kind: 'raise', err }
    return { kind: 'retry' }
  }
}

// GET with retry: network-level throws and 429/502/503/504 responses retry on
// the fixed backoff; other statuses return as-is.
export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const outcome = await attemptGet(url, opts, attempt >= RETRY_BACKOFF_MS.length)
    if (outcome.kind === 'response') return outcome.res
    if (outcome.kind === 'raise') throw outcome.err
    await Bun.sleep(RETRY_BACKOFF_MS[attempt] ?? 750)
  }
}

function assertTextual(res: Response, url: string): void {
  const header = res.headers.get('content-type')
  if (!header) return
  const mime = (header.split(';')[0] ?? '').trim().toLowerCase()
  const ok =
    mime === '' ||
    mime.startsWith('text/') ||
    mime.endsWith('+xml') ||
    mime.endsWith('+json') ||
    TEXTUAL_MIMES.has(mime)
  if (!ok)
    throw new Error(`fetch ${url}: unsupported content-type "${mime}" — use media --download`)
}

async function okText(res: Response, url: string): Promise<string> {
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`)
  assertTextual(res, url)
  return readTextCapped(res, url, MAX_TEXT_BYTES)
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return okText(await httpGet(url, opts), url)
}

// The ROOT of a crawl/map is the user's explicit target: follow its redirects
// freely (apex→www is ubiquitous) and report the FINAL url so callers can
// re-anchor their host scope on it.
export async function fetchRoot(
  url: string,
  opts: FetchOptions = {},
): Promise<{ finalUrl: string; html: string }> {
  const res = await httpGet(url, opts)
  return { finalUrl: res.url || url, html: await okText(res, url) }
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}

// Fetch text but follow redirects MANUALLY, blocking any hop that leaves `host`
// (EXACT hostname match — scope control for crawls, not an IP/SSRF filter).
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
    if (!sameHost(host, current)) throw new Error(`redirect off-site blocked: ${current}`)
  }
  throw new Error(`too many redirects: ${url}`)
}
