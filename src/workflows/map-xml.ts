import { removeAll } from '../core/remove-all.ts'
import { normalizeUrl } from '../core/url.ts'

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
// Named XML entities and numeric references; anything else is left as written.
const decodeXml = (text: string): string =>
  text.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(\w+));/gi,
    (m, dec?: string, hex?: string, name?: string) => {
      const code = dec ? Number(dec) : hex ? Number.parseInt(hex, 16) : undefined
      if (code === undefined) return XML_ENTITIES[name ?? ''] ?? m
      return code <= 0x10ffff ? String.fromCodePoint(code) : m
    },
  )
export const withoutComments = (xml: string): string => removeAll(xml, /<!--[\s\S]*?-->/g)

// The root element's namespace prefix (`sm:` in <sm:urlset>), or '' when unprefixed. Only
// tags with that prefix count, so <image:loc> inside a <url> is not read as a page.
export const rootPrefix = (xml: string): string => {
  const prefix = /<(?:([\w.-]+):)?(?:urlset|sitemapindex)[\s>]/i.exec(xml)?.[1]
  return prefix ? `${prefix.replace(/[\\^$.*+?()[\]{}|-]/g, '\\$&')}:` : ''
}

// 2602.15921: at the limit cut, each first path segment gets at most an even share of the
// limit; spare room then backfills from the capped links, best-first order kept.
export function capPrefixes(links: string[], limit: number): string[] {
  if (links.length <= limit) return links
  const prefixOf = (u: string) => URL.parse(u)?.pathname.split('/')[1] ?? ''
  const share = Math.max(1, Math.ceil(limit / new Set(links.map(prefixOf)).size))
  const counts = new Map<string, number>()
  const fair = links.filter((u) => {
    const n = (counts.get(prefixOf(u)) ?? 0) + 1
    counts.set(prefixOf(u), n)
    return n <= share
  })
  const fairSet = new Set(fair)
  const keep = new Set([...fair, ...links.filter((u) => !fairSet.has(u))].slice(0, limit))
  return links.filter((u) => keep.has(u))
}

// Each loc resolves against the sitemap's own URL, so relative locs count. Comments
// are ignored, tags are case-insensitive, and a loc may be CDATA or hold entities.
export function locsOf(xml: string, base: string, prefix: string): string[] {
  const loc = new RegExp(
    `<${prefix}loc>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*?))\\s*<\\/${prefix}loc>`,
    'gi',
  )
  return [...withoutComments(xml).matchAll(loc)].flatMap(
    (m) => normalizeUrl(m[1] ?? decodeXml(m[2] ?? '').trim(), base) ?? [],
  )
}
