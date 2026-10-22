// Single URL-identity authority: canonical form for dedup + EXACT-host
// scoping. Exact hostname match is deliberate — apex/www siblings are
// off-scope by design, and this is a scope check, not an IP/SSRF filter.

// Query keys that only track the visitor; they never change the page.
// Bare `ref` stays: GitHub and many sites use ?ref= to pick a branch or page.
const TRACKING =
  /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_[ce]id$|ref_src$|igshid$|_ga$|_gl$|gbraid$|wbraid$|yclid$)/

// WHATWG URL already lowercases scheme and host and drops the default port;
// on top: no fragment, uppercase percent escapes, no tracking params; the rest of the query is untouched.
export function normalizeUrl(raw: string, base?: string): string | null {
  const url = URL.parse(raw, base)
  if (!url) return null
  url.hash = ''
  url.pathname = url.pathname.replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase())
  // Edit the raw query, never re-serialize it: `?foo` and `%20` stay as written.
  // The search setter strips one leading `?`, so add it back: a query that starts
  // with a literal `?` (`/??`) keeps it, and an empty query drops the `?`.
  const query = url.search
    .slice(1)
    .split('&')
    .filter((p) => p && !TRACKING.test(p.replace(/=.*/, '')))
    .join('&')
  url.search = query && `?${query}`
  return url.toString()
}

// Dedupe key: the normalized URL with its raw query pairs sorted, so
// ?a=1&b=2 and ?b=2&a=1 count as one page. A key only; never fetch it.
export function dedupeKey(raw: string): string | null {
  const url = URL.parse(normalizeUrl(raw) ?? '')
  if (!url) return null
  url.search = url.search.slice(1).split('&').sort().join('&')
  return url.toString()
}

// A page's <base href> sets where its relative links point; only a web URL counts.
export function documentBase(baseHref: string | null | undefined, pageUrl: string): string {
  const base = baseHref ? normalizeUrl(baseHref, pageUrl) : null
  return base && /^https?:/.test(base) ? base : pageUrl
}

// rel holds space-separated tokens, matched case-insensitively.
export const hasRelToken = (rel: string | null | undefined, token: string): boolean =>
  (rel ?? '').toLowerCase().split(/\s+/).includes(token)

// host:port with the DNS root dot dropped, so `example.com.` equals `example.com`.
const dotless = (host: string | undefined): string | undefined => host?.replace(/\.(?=:|$)/, '')
const hostKey = (url: string) => dotless(URL.parse(url)?.host)

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
    if (!hasRelToken(attr(tag, 'rel'), 'canonical')) continue
    const href = normalizeUrl(attr(tag, 'href') ?? '', resolveFrom)
    if (href && hostKey(href) === hostKey(base)) return href // off-host canonicals never move scope
  }
  return normalizeUrl(base) ?? base
}

// The host goes through the URL parser too, so a Unicode host matches its punycode form.
export function sameHost(host: string, candidateUrl: string): boolean {
  const want = dotless(URL.parse(`http://${host}`)?.hostname)
  return want !== undefined && dotless(URL.parse(candidateUrl)?.hostname) === want
}
