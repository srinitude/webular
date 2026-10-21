// Keyless feed discovery from the site itself: fetch the page and read its
// <link rel="alternate" type="application/rss+xml | atom+xml"> tags, the
// autodiscovery standard every feed reader follows. Second source for `feed`,
// beside feedsearch.dev: it needs no third-party index, only the site's own HTML.
import { Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

const FEED_TYPE = /^application\/(rss|atom)\+xml$/i

const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(Boolean)

// The feed links in `html`, hrefs resolved against `site`. ponytail: a regex
// over <link> tags; a page with unquoted attribute values is missed, so move to
// an HTML parser if one shows up in the wild.
const feedLinks = (html: string, site: string): Hit[] =>
  (html.match(/<link\b[^>]*>/gi) ?? []).flatMap((tag) => {
    const href = attr(tag, 'href')
    const isFeed =
      attr(tag, 'rel')?.toLowerCase().includes('alternate') &&
      FEED_TYPE.test(attr(tag, 'type') ?? '')
    if (!href || !isFeed) return []
    const url = URL.parse(href, site)?.toString()
    return url ? [{ title: attr(tag, 'title') ?? url, url, description: '' }] : []
  })

// `query` is the site URL or host.
export const siteFeeds = (query: string, limit: number): Effect.Effect<Hit[], unknown> => {
  const site = /^https?:\/\//i.test(query) ? query : `https://${query}`
  return getJson(Schema.String, site, {}).pipe(
    Effect.map((html) => feedLinks(html, site).slice(0, limit)),
  )
}
