// CRAWL accuracy eval: a link-only site with traps, crawled by the real CLI and scored
// against a gold page list written from the fixture design (never from crawl output).
// Traps: off-domain and mailto links, robots-disallowed paths, a 404 link, links past
// --depth, and duplicate forms of one page (/docs/ alias, #fragment, utm_* params).
// A trap listed is a false positive; a reachable page missing is a miss.
import { describe, expect, test } from 'bun:test'
import { Config, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'
import { scoreboardValue } from '../_support/scoreboard.ts'

const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html' } })
// Each page carries its own vocabulary so near-duplicate detection never merges two real pages.
const page = (title: string, words: string, links: string[]) =>
  html(
    `<html><head><title>${title}</title></head><body><h1>${title}</h1><p>${words}</p>${links
      .map((l) => `<a href="${l}">link</a>`)
      .join(' ')}</body></html>`,
  )

const HOME = 'Welcome landing hero banner newsletter pricing testimonials partners showcase'
const ABOUT = 'Founders story mission hiring office kitchen espresso bicycle garden lantern harbor'
const DOCS =
  'Install configure deploy tokens pipelines retries caching shards queues metrics tracing'
const CONTACT =
  'Telephone address postcode directions parking tram station entrance reception hours'
const TEAM = 'Engineers designers analysts mentors interns alumni retreat cohort roster onboarding'
const GUIDE = 'Walkthrough tutorial cookbook recipes snippets examples sandbox exercises solutions'
const MAP = 'Compass latitude longitude landmark bridge river district neighborhood plaza fountain'
const DEEP = 'Appendix glossary changelog archive legacy migration deprecated internals footnotes'
const SHOP = 'Basket checkout shipping returns catalog wishlist coupons warranty delivery invoice'
const ITEM = 'Dimensions weight material colour sizes stock reviews rating accessories variants'
const SECRET = 'Confidential payroll credentials backups vault ledger audit invoices salaries'

// The root links every trap: aliases, a fragment, utm params, a redirect, robots, 404, off-site.
const HOME_LINKS = [
  '/about',
  '/docs',
  '/docs/',
  '/about#team',
  '/about?utm_source=news&utm_medium=email',
  '/contact',
  '/shop',
  '/old',
  '/private/secret',
  '/missing',
  'https://other.example/x',
  '//other.example/y',
  'mailto:a@b.c',
]

const fx = useFixture((o) => ({
  '/robots.txt': () => new Response('User-agent: *\nDisallow: /private/\n'),
  '/': () => page('Home', HOME, HOME_LINKS),
  '/about': () => page('About', ABOUT, ['/about/team', '/private/payroll']),
  '/about/team': () => page('Team', TEAM, ['/about/team/alumni']),
  '/about/team/alumni': () => page('Alumni', DEEP, []),
  '/docs': () => page('Docs', DOCS, ['/docs/guide', `${o}/docs/guide?utm_campaign=x`]),
  '/docs/': () => page('Docs', DOCS, ['/docs/guide']),
  '/docs/guide': () => page('Guide', GUIDE, ['/docs/guide/deep']),
  '/docs/guide/deep': () => page('Deep', DEEP, []),
  '/contact': () => page('Contact', CONTACT, ['/contact/map#top']),
  '/contact/map': () => page('Map', MAP, []),
  '/shop': () =>
    page('Shop', SHOP, ['/shop/item?a=1&b=2', '/shop/item?b=2&a=1', '/shop/./item?a=1&b=2']),
  '/shop/item': () => page('Item', ITEM, []),
  '/old': () => new Response(null, { status: 301, headers: { location: '/about' } }),
  '/private/secret': () => page('Secret', SECRET, []),
  '/private/payroll': () => page('Payroll', SECRET, []),
}))

// Gold, from the design: --depth 2 reaches pages up to two hops from the root; each page once.
const GOLD_PATHS = [
  '/',
  '/about',
  '/docs',
  '/contact',
  '/about/team',
  '/docs/guide',
  '/contact/map',
  '/shop',
  '/shop/item?a=1&b=2',
]
// One page, one fetch: query order, dot segments, and a redirect alias never add a second.
const ONE_FETCH = ['/shop/item']
const DISALLOWED = ['/private/secret', '/private/payroll']

const decodeCrawl = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Struct({ pages: Schema.Array(Schema.Struct({ url: Schema.String })) }),
  ),
)

const crawlUrls = Effect.gen(function* () {
  // An explicit env replaces the parent's: keep the shell's PATH, drop the cache.
  const PATH = yield* Config.String('PATH')
  const args = ['--url', `${fx.origin}/`, '--limit', '50', '--depth', '2', '--json']
  const { code, out } = yield* runCli('src/commands/crawl.ts', args, {
    env: { WEBULAR_NO_CACHE: '1', PATH },
  })
  expect(code).toBe(0)
  return (yield* decodeCrawl(out)).pages.map((p) => p.url)
})

const score = (urls: readonly string[], want: string[]) => {
  const hits = urls.filter((u) => want.includes(u)).length
  return { precision: urls.length ? hits / urls.length : 0, recall: hits / want.length }
}

const BOARD = [scoreboardValue('crawl', 'precision'), scoreboardValue('crawl', 'recall')]

describe('webular crawl — coverage against a gold page list', () => {
  test(
    'precision and recall are 1, robots-disallowed paths stay unfetched, two runs agree',
    eff(
      Effect.gen(function* () {
        const first = yield* crawlUrls
        const second = yield* crawlUrls
        const s = score(
          first,
          GOLD_PATHS.map((p) => `${fx.origin}${p}`),
        )
        yield* Effect.logInfo(
          `crawl-accuracy precision=${s.precision.toFixed(3)} recall=${s.recall.toFixed(3)} deterministic=${String(first.join() === second.join())} n=${first.length} pages=${first.join(' ')}`,
        )
        expect(first).toEqual(second)
        expect([s.precision, s.recall]).toEqual([1, 1])
        expect([s.precision, s.recall]).toEqual(BOARD)
        for (const p of DISALLOWED) expect(fx.hits(p)).toBe(0)
        for (const p of ONE_FETCH) expect(fx.hits(p)).toBe(2) // once per crawl, two crawls
      }),
    ),
    120_000,
  )
})
