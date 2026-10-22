// Map's root page: the user's explicit target. robots.txt comes first: map has
// no override, so a disallowed root is never fetched, and `blocked` keeps the
// archive fallback off. An allowed root follows its redirects, anchors the
// sitemap origin and host scope on the FINAL url, and its HTML is reused for
// page links (no second fetch).
import { Effect } from 'effect'
import { fetchRoot } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { sameHost } from '../core/url.ts'
import { extractLinks } from './html.ts'
import { type RobotsGate, robotsGate } from './robots-gate.ts'

interface RootFetch {
  final: string
  rootHtml: string | null
  errors: { url: string; reason: string }[]
  blocked?: boolean
}

const noRoot = (url: string, reason: string, blocked = false): RootFetch => ({
  final: url,
  rootHtml: null,
  errors: [{ url, reason }],
  blocked,
})

export const fetchRootFor = (
  url: string,
  timeoutMs: number,
): Effect.Effect<RootFetch, never, RobotsGate> =>
  Effect.matchEffect(robotsGate(url), {
    onFailure: (e) => Effect.succeed(noRoot(url, `blocked: robots.txt disallows ${e.rule}`, true)),
    onSuccess: () =>
      Effect.match(fetchRoot(url, { timeoutMs }), {
        onFailure: (err) => noRoot(url, errMsg(err)),
        onSuccess: (entry): RootFetch => ({
          final: entry.finalUrl,
          rootHtml: entry.html,
          errors: [],
        }),
      }),
  })

// Origin-root page links join a /sitemap.xml result (sitemap order first); a deep
// target's links or a robots.txt sitemap stand alone. No sitemap links: page links.
export function pageLinks(
  root: RootFetch,
  sitemap: { links: string[]; fromSitemapXml: boolean } | null,
) {
  const final = new URL(root.final)
  const merge = sitemap?.fromSitemapXml === true && final.pathname === '/'
  if (!root.rootHtml || (sitemap && sitemap.links.length > 0 && !merge)) return []
  return extractLinks(root.rootHtml, root.final).filter((u) => sameHost(final.hostname, u))
}
