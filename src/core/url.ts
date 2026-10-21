// Single URL-identity authority: canonical form for dedup + EXACT-host
// scoping. Exact hostname match is deliberate — apex/www siblings are
// off-scope by design, and this is a scope check, not an IP/SSRF filter.
export function normalizeUrl(raw: string, base?: string): string | null {
  const url = URL.parse(raw, base)
  if (!url) return null
  url.hash = ''
  return url.toString()
}

export function sameHost(host: string, candidateUrl: string): boolean {
  return URL.parse(candidateUrl)?.hostname === host.toLowerCase()
}
