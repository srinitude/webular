// GitHub search, NCBI E-utilities, feedsearch.dev and Common Crawl CDX adapters, and the
// all-at-once status rows, against recorded live responses served by a real
// local fixture. No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { commonCrawlCdx } from '../../../src/lib/sources/archives.ts'
import { freeSourceStatus } from '../../../src/lib/sources/registry.ts'
import { ncbiEutils } from '../../../src/lib/sources/scholarly.ts'
import { feedSearch, githubSearch } from '../../../src/lib/sources/web.ts'
import { against, body, json, run } from './support.ts'

const githubCase = Effect.gen(function* () {
  const text = yield* body('github-search.json')
  const seen = { q: '' }
  const route = (_: Request, url: URL) => {
    seen.q = url.searchParams.get('q') ?? ''
    return json(text)
  }
  const hits = yield* against(
    { '/search/repositories': route },
    githubSearch('effect typescript', 2),
  )
  expect(seen.q).toBe('effect typescript')
  expect(hits.map((h) => h.url)).toEqual([
    'https://github.com/Effect-TS/effect',
    'https://github.com/danvk/effective-typescript',
  ])
  expect(hits[0]?.description).toContain('stars')
})

const ncbiCase = Effect.gen(function* () {
  const search = yield* body('ncbi-esearch.json')
  const summary = yield* body('ncbi-esummary.json')
  const seen = { ids: '' }
  const routes = {
    '/entrez/eutils/esearch.fcgi': () => json(search),
    '/entrez/eutils/esummary.fcgi': (_: Request, url: URL) => {
      seen.ids = url.searchParams.get('id') ?? ''
      return json(summary)
    },
  }
  const hits = yield* against(routes, ncbiEutils('crispr', 2))
  expect(seen.ids).toBe('42901663,42901363')
  expect(hits.length).toBe(2)
  expect(hits[0]?.url).toBe('https://doi.org/10.1016/j.fm.2026.105310')
  expect(hits[0]?.title).toStartWith('The application progress')
})

const ncbiEmptyCase = Effect.gen(function* () {
  const none = JSON.stringify({ esearchresult: { idlist: [] } })
  const hits = yield* against(
    { '/entrez/eutils/esearch.fcgi': () => json(none) },
    ncbiEutils('zzzz', 2),
  )
  expect(hits).toEqual([])
})

const feedCase = Effect.gen(function* () {
  const text = yield* body('feedsearch.json')
  const hits = yield* against({ '/api/v1/search': () => json(text) }, feedSearch('xkcd.com', 5))
  expect(hits.map((h) => h.url)).toEqual(['https://xkcd.com/rss.xml', 'https://xkcd.com/atom.xml'])
})

// answer asks seven sources at once; two answer, five get a 404 and say so.
const statusCase = Effect.gen(function* () {
  const github = yield* body('github-search.json')
  const wiki = yield* body('wikidata-search.json')
  const routes = { '/search/repositories': () => json(github), '/w/api.php': () => json(wiki) }
  const rows = yield* against(routes, freeSourceStatus('answer', 'effect', 2))
  expect(rows.map((r) => [r.source, r.ok])).toEqual([
    ['wikidata', true],
    ['wikidata-sparql', false],
    ['europepmc', false],
    ['openlibrary', false],
    ['stackexchange', false],
    ['github-search', true],
    ['hn-algolia', false],
  ])
  expect(rows[5]?.hits.length).toBe(2)
  expect(rows[1]?.error?.length).toBeGreaterThan(0)
})

// collinfo.json is the recorded list cut to its first two crawls; the CDX body
// is a recorded one-object-per-line answer.
const commonCrawlCase = Effect.gen(function* () {
  const collinfo = yield* body('commoncrawl-collinfo.json')
  const cdx = yield* body('commoncrawl-cdx.ndjson')
  const seen = { url: '' }
  const routes = {
    '/collinfo.json': () => json(collinfo),
    '/CC-MAIN-2026-39-index': (_: Request, url: URL) => {
      seen.url = url.searchParams.get('url') ?? ''
      return new Response(cdx)
    },
  }
  const hits = yield* against(routes, commonCrawlCdx('bun.sh/docs/*', 3))
  expect(seen.url).toBe('bun.sh/docs/*')
  expect(hits.map((h) => h.url)).toEqual([
    'https://bun.sh/docs/api/file-io.md',
    'https://bun.sh/docs/api/http.md',
    'https://bun.sh/docs/api/image',
  ])
  expect(hits[0]?.description).toStartWith('CC-MAIN-2026-39 20260905115953')
})

describe('search, research and feed sources', () => {
  test('githubSearch maps repositories with stars', () => run(githubCase), 15_000)
  test('ncbiEutils resolves ids to DOI links', () => run(ncbiCase), 15_000)
  test('ncbiEutils skips esummary when nothing matched', () => run(ncbiEmptyCase), 15_000)
  test('feedSearch lists a site feeds', () => run(feedCase), 15_000)
  test(
    'commonCrawlCdx reads the first listed crawl, one row per line',
    () => run(commonCrawlCase),
    15_000,
  )
  test(
    'freeSourceStatus gives one row per source, failures included',
    () => run(statusCase),
    15_000,
  )
})
