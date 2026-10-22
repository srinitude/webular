// Single URL-identity authority: canonical form for dedup + EXACT-host
// scoping. Exact hostname match is deliberate — apex/www siblings are
// off-scope by design, and this is a scope check, not an IP/SSRF filter.

// Query keys that only track the visitor; they never change the page.
// Bare `ref` stays: GitHub and many sites use ?ref= to pick a branch or page.
const TRACKING =
  /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_[ce]id$|ref_src$|igshid$|_ga$|_gl$|gbraid$|wbraid$|yclid$)/

// WHATWG URL already lowercases scheme and host and drops the default port;
// on top: no fragment, uppercase percent escapes, no tracking params, sorted params.
export function normalizeUrl(raw: string, base?: string): string | null {
  const url = URL.parse(raw, base)
  if (!url) return null
  url.hash = ''
  url.pathname = url.pathname.replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase())
  for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k)
  url.searchParams.sort()
  return url.toString()
}

// A page's <base href> sets where its relative links point; only a web URL counts.
export function documentBase(baseHref: string | null | undefined, pageUrl: string): string {
  const base = baseHref ? normalizeUrl(baseHref, pageUrl) : null
  return base && /^https?:/.test(base) ? base : pageUrl
}

const LINK_TAG = /<link\b[^>]*>/gi
const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined)

// ponytail: regex over <link> tags, not a DOM parse; an href with an escaped
// quote or a tag inside a comment can slip through. Parse with linkedom if seen.
export function canonicalUrl(html: string, base: string): string {
  const baseTag = /<base\b[^>]*>/i.exec(html)?.[0]
  const resolveFrom = documentBase(baseTag && attr(baseTag, 'href'), base)
  for (const [tag] of html.matchAll(LINK_TAG)) {
    if (!/^canonical$/i.test(attr(tag, 'rel')?.trim() ?? '')) continue
    const href = normalizeUrl(attr(tag, 'href') ?? '', resolveFrom)
    if (href && URL.parse(href)?.host === URL.parse(base)?.host) return href // off-host canonicals never move scope
  }
  return normalizeUrl(base) ?? base
}

// The host goes through the URL parser too, so a Unicode host matches its punycode form.
export function sameHost(host: string, candidateUrl: string): boolean {
  const want = URL.parse(`http://${host}`)?.hostname
  return want !== undefined && URL.parse(candidateUrl)?.hostname === want
}
