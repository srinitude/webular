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
export const withoutComments = (xml: string): string => xml.replace(/<!--[\s\S]*?-->/g, '')

// The root element's namespace prefix (`sm:` in <sm:urlset>), or '' when unprefixed. Only
// tags with that prefix count, so <image:loc> inside a <url> is not read as a page.
export const rootPrefix = (xml: string): string => {
  const prefix = /<(?:([\w.-]+):)?(?:urlset|sitemapindex)[\s>]/i.exec(xml)?.[1]
  return prefix ? `${prefix.replace(/\./g, '\\.')}:` : ''
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
