// FOSS fetch layer built on Bun.fetch (proxy, timeout, user-agent, redirects).
const USER_AGENT = 'webular/0.0.0 (+https://github.com/srinitude/webular)'

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

async function okText(res: Response, url: string): Promise<string> {
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`)
  return await res.text()
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return okText(await httpGet(url, opts), url)
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
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
    if (new URL(current).hostname !== host) throw new Error(`redirect off-host blocked: ${current}`)
  }
  throw new Error(`too many redirects: ${url}`)
}
