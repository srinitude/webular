// When a site's own fetch fails, map and crawl ask the archive indexes which
// URLs the site had (2603.01548). Same-host original URLs only; an index that
// has nothing, or fails, yields none, so the caller keeps its own error.
import { Effect } from 'effect'
import { sameHost } from '../core/url.ts'
import { freeSourceFallback } from './sources/registry.ts'

// A Wayback hit points into the archive; the page it captured is after the timestamp.
const WAYBACK = /^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\//

// Both CDX adapters end each description with "<mime> HTTP <status>". Only an
// HTML capture that returned 200 is a live page (2507.14752): redirects, errors,
// and images would send map and crawl to dead or non-page URLs.
const LIVE_PAGE = /(?:^|\s)(?:text\/html|application\/xhtml\+xml) HTTP 200$/

// Two indexes, or two captures, often list the same page; keep it once, in rank order.
export const livePageUrls = (
  host: string,
  hits: ReadonlyArray<{ readonly url: string; readonly description: string }>,
): string[] => [
  ...new Set(
    hits
      .filter((hit) => LIVE_PAGE.test(hit.description))
      .map((hit) => hit.url.replace(WAYBACK, ''))
      .filter((url) => sameHost(host, url)),
  ),
]

export const archivedUrls = (command: 'map' | 'crawl', site: string, limit: number) => {
  const host = new URL(site).hostname
  return freeSourceFallback(command, `${host}/*`, limit).pipe(
    Effect.map(({ results }) => livePageUrls(host, results)),
    Effect.catch(() => Effect.succeed<string[]>([])),
  )
}
