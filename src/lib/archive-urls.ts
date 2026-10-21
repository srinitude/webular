// When a site's own fetch fails, map and crawl ask the archive indexes which
// URLs the site had (2603.01548). Same-host original URLs only; an index that
// has nothing, or fails, yields none, so the caller keeps its own error.
import { Effect } from 'effect'
import { sameHost } from '../core/url.ts'
import { freeSourceFallback } from './sources/registry.ts'

// A Wayback hit points into the archive; the page it captured is after the timestamp.
const WAYBACK = /^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\//

export const archivedUrls = (command: 'map' | 'crawl', site: string, limit: number) => {
  const host = new URL(site).hostname
  return freeSourceFallback(command, `${host}/*`, limit).pipe(
    Effect.map(({ results }) =>
      results.map((hit) => hit.url.replace(WAYBACK, '')).filter((url) => sameHost(host, url)),
    ),
    Effect.catch(() => Effect.succeed<string[]>([])),
  )
}
