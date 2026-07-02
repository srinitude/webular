// Single URL-identity authority: canonical form for dedup + EXACT-host
// scoping. Exact hostname match is deliberate — apex/www siblings are
// off-scope by design, and this is a scope check, not an IP/SSRF filter.
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base)
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function sameHost(host: string, candidateUrl: string): boolean {
  try {
    return new URL(candidateUrl).hostname === host.toLowerCase()
  } catch {
    return false
  }
}
