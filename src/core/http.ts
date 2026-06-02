// FOSS fetch layer built on Bun.fetch (proxy, timeout, user-agent).
const USER_AGENT = 'webular/0.0.0 (+https://github.com/srinitude/webular)'

export interface FetchOptions {
  timeoutMs?: number
  headers?: Record<string, string>
  proxy?: string
}

export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 30_000)
  const init: RequestInit & { proxy?: string } = {
    headers: { 'user-agent': USER_AGENT, ...opts.headers },
    redirect: 'follow',
    signal,
  }
  if (opts.proxy) init.proxy = opts.proxy
  return await fetch(url, init)
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await httpGet(url, opts)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`)
  return await res.text()
}
