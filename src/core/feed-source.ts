// Feed source resolution: the given url as a feed, else the page's
// <link rel="alternate"> feeds (first MAX_ALTERNATES), else same-origin
// guesses, else (with `archive`) a Wayback copy of the given url, else the feeds
// the free feed search lists for the url.
import { Data, Effect } from 'effect'
import { DOMParser } from 'linkedom'
import { fetchTextObeyingRobots, robotsHopGate } from '../lib/robots-gate.ts'
import { freeSourceFallback } from '../lib/sources/registry.ts'
import { fetchTextOrArchive } from './archive.ts'
import type { FetchOptions } from './http.ts'

interface SourceOptions extends FetchOptions {
  archive?: boolean | undefined
  archiveOrigin?: string | undefined
}

// A live page that is not a feed and links to none that works.
// An own message field, as HttpStatusError explains.
class NotAFeed extends Data.TaggedError('NotAFeed')<{ url: string }> {
  override message = `no feed found at ${this.url}`
}

const MAX_ALTERNATES = 3
const GUESSES = ['/feed', '/rss', '/feed.xml', '/atom.xml', '/rss.xml']
const FEED_TYPE = /^application\/(rss|atom)\+xml$/i
const FEED_ROOTS = new Set(['rss', 'feed', 'rdf:rdf'])

const isFeed = (xml: string): boolean => {
  const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement
  return FEED_ROOTS.has(root?.tagName.toLowerCase() ?? '')
}

// Links resolve against the page's <base href> when it parses; one that does
// not parse is skipped, so a bad href never takes a slot or throws.
function alternates(html: string, page: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const links = [...doc.querySelectorAll('link[rel~="alternate"][href]')] as Element[]
  const baseHref = doc.querySelector('base[href]')?.getAttribute('href') ?? ''
  const base = URL.canParse(baseHref, page) ? new URL(baseHref, page).toString() : page
  return links
    .filter((l) => FEED_TYPE.test(l.getAttribute('type') ?? ''))
    .map((l) => l.getAttribute('href') ?? '')
    .filter((href) => URL.canParse(href, base))
    .slice(0, MAX_ALTERNATES)
    .map((href) => new URL(href, base).toString())
}

const guesses = (url: string): string[] =>
  GUESSES.map((path) => new URL(path, url).toString()).filter((u) => u !== url)

interface Found {
  xml: string
  feedUrl: string
  archivedFrom?: string | undefined
}

const asFeed = (found: Found) =>
  isFeed(found.xml) ? Effect.succeed(found) : Effect.fail(new NotAFeed({ url: found.feedUrl }))

const tryFeed = (feedUrl: string, opts: FetchOptions) =>
  Effect.flatMap(fetchTextObeyingRobots(feedUrl, opts), (xml) => asFeed({ xml, feedUrl }))

// ponytail: the Wayback step re-fetches the dead url once; reuse the first
// failure when archive.ts exposes its archive-only path.
const fromWayback = (url: string, opts: SourceOptions) =>
  Effect.flatMap(robotsHopGate, (allow) =>
    Effect.andThen(allow(url), fetchTextOrArchive(url, { ...opts, hopGate: allow })),
  ).pipe(
    Effect.flatMap(({ html, archivedFrom }) => asFeed({ xml: html, feedUrl: url, archivedFrom })),
  )

// The feeds the free search lists for the url, tried in rank order. When it
// has none (or none works), the chain's own error stands.
const fromFreeSources = <E>(url: string, opts: FetchOptions, chainError: E) =>
  freeSourceFallback('feed', url, MAX_ALTERNATES).pipe(
    Effect.flatMap(({ results }) =>
      Effect.firstSuccessOf(results.map((hit) => tryFeed(hit.url, opts))),
    ),
    Effect.mapError(() => chainError),
  )

const resolveChain = (url: string, opts: SourceOptions) =>
  fetchTextObeyingRobots(url, opts).pipe(
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

// Candidates run one at a time, first success wins; a live non-feed page never
// asks the archive, so its last error is NotAFeed. Wayback runs only with
// `archive`, like scrape. When the whole chain fails, the free feed search
// answers.
export const resolveFeed = (url: string, opts: SourceOptions = {}) =>
  resolveChain(url, opts).pipe(Effect.catch((err) => fromFreeSources(url, opts, err)))
