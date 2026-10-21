// Feed source resolution: the given url as a feed, else the page's
// <link rel="alternate"> feeds (first MAX_ALTERNATES), else same-origin
// guesses, else (with `archive`) a Wayback copy of the given url.
import { Data, Effect } from 'effect'
import { DOMParser } from 'linkedom'
import { fetchTextOrArchive } from './archive.ts'
import { type FetchOptions, fetchTextEffect } from './http.ts'

interface SourceOptions extends FetchOptions {
  archive?: boolean
  archiveOrigin?: string
}

// A live page that is not a feed and links to none that works.
class NotAFeed extends Data.TaggedError('NotAFeed')<{ url: string }> {
  override get message(): string {
    return `no feed found at ${this.url}`
  }
}

const MAX_ALTERNATES = 3
const GUESSES = ['/feed', '/rss', '/feed.xml', '/atom.xml', '/rss.xml']
const FEED_TYPE = /^application\/(rss|atom)\+xml$/i
const FEED_ROOTS = new Set(['rss', 'feed', 'rdf:rdf'])

const isFeed = (xml: string): boolean => {
  const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement
  return FEED_ROOTS.has(root?.tagName.toLowerCase() ?? '')
}

function alternates(html: string, base: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const links = [...doc.querySelectorAll('link[rel~="alternate"][href]')] as Element[]
  return links
    .filter((l) => FEED_TYPE.test(l.getAttribute('type') ?? ''))
    .slice(0, MAX_ALTERNATES)
    .map((l) => new URL(l.getAttribute('href') ?? '', base).toString())
}

const guesses = (url: string): string[] =>
  GUESSES.map((path) => new URL(path, url).toString()).filter((u) => u !== url)

interface Found {
  xml: string
  feedUrl: string
  archivedFrom?: string
}

const asFeed = (found: Found) =>
  isFeed(found.xml) ? Effect.succeed(found) : Effect.fail(new NotAFeed({ url: found.feedUrl }))

const tryFeed = (feedUrl: string, opts: FetchOptions) =>
  Effect.flatMap(fetchTextEffect(feedUrl, opts), (xml) => asFeed({ xml, feedUrl }))

// ponytail: the Wayback step re-fetches the dead url once; reuse the first
// failure when archive.ts exposes its archive-only path.
const fromWayback = (url: string, opts: SourceOptions) =>
  Effect.flatMap(fetchTextOrArchive(url, opts), ({ html, archivedFrom }) =>
    asFeed({ xml: html, feedUrl: url, archivedFrom }),
  )

// Candidates run one at a time, first success wins; a live non-feed page never
// asks the archive, so its last error is NotAFeed. Wayback runs only with
// `archive`, like scrape.
export const resolveFeed = (url: string, opts: SourceOptions = {}) =>
  fetchTextEffect(url, opts).pipe(
    Effect.matchEffect({
      onSuccess: (body) =>
        isFeed(body)
          ? Effect.succeed<Found>({ xml: body, feedUrl: url })
          : Effect.firstSuccessOf(
              [...alternates(body, url), ...guesses(url)].map((u) => tryFeed(u, opts)),
            ).pipe(Effect.mapError(() => new NotAFeed({ url }))),
      onFailure: () =>
        Effect.firstSuccessOf([
          ...guesses(url).map((u) => tryFeed(u, opts)),
          fromWayback(url, opts),
        ]),
    }),
  )
