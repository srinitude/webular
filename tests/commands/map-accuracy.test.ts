// MAP accuracy eval: a real-shaped local site (nested sitemap index, gzip child,
// robots.txt Sitemap: line, duplicate link forms) scored against a gold URL set.
// A duplicate form of a gold page (/docs vs /docs/, /index.html vs /) is a false positive.
import { describe, expect, test } from 'bun:test'
import { Duration, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'
import { scoreboardValue } from '../_support/scoreboard.ts'

const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
const urlset = (locs: string[]) =>
  `<?xml version="1.0"?><urlset ${NS}>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`
const asXml = (body: string | ReadableStream, type = 'application/xml') =>
  new Response(body, { headers: { 'content-type': type } })
const gzipped = (text: string) =>
  new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))

const fx = useFixture((o) => ({
  '/robots.txt': () => new Response(`User-agent: *\nAllow: /\nSitemap: ${o}/sitemap-extra.xml\n`),
  '/sitemap.xml': () =>
    asXml(
      `<?xml version="1.0"?><sitemapindex ${NS}><sitemap><loc>${o}/sitemap-pages.xml.gz</loc></sitemap><sitemap><loc>/sitemap-blog.xml</loc></sitemap></sitemapindex>`,
    ),
  '/sitemap-pages.xml.gz': () =>
    asXml(
      gzipped(urlset([`${o}/`, `${o}/docs/`, `${o}/about`, `${o}/pricing?b=2&amp;a=1`])),
      'application/gzip',
    ),
  '/sitemap-blog.xml': () => asXml(urlset([`${o}/blog/one`, `${o}/blog/two/`])),
  '/sitemap-extra.xml': () => asXml(urlset([`${o}/careers`, `${o}/legal`])),
  '/': () =>
    new Response(
      `<html><head><link rel="canonical" href="${o}/"></head><body>
<a href="docs">Docs</a> <a href="${o.replace('http:', '')}/about#team">About</a>
<a href="/pricing?a=1&b=2&utm_source=x">Pricing</a> <a href="/index.html">Home</a>
<a href="/blog/one/">One</a> <a href="/contact">Contact</a>
<a href="https://other.example/x">Off</a> <a href="mailto:a@b.c">Mail</a></body></html>`,
      { headers: { 'content-type': 'text/html' } },
    ),
}))

const GOLD_PATHS = ['/', '/docs/', '/about', '/pricing?b=2&a=1', '/blog/one', '/blog/two/']
const gold = (o: string) => [...GOLD_PATHS, '/careers', '/legal', '/contact'].map((p) => `${o}${p}`)

const decodeLinks = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ links: Schema.Array(Schema.String) })),
)

const score = (links: readonly string[], want: string[]) => {
  const hits = links.filter((l) => want.includes(l)).length
  return { recall: hits / want.length, precision: links.length ? hits / links.length : 0 }
}

describe('webular map — accuracy against a gold URL set', () => {
  test(
    'recall and precision on a real-shaped site',
    eff(
      Effect.gen(function* () {
        const runs: number[] = []
        const outs: string[] = []
        for (let i = 0; i < 3; i++) {
          const [took, { code, out }] = yield* Effect.timed(
            runCli('src/commands/map.ts', ['--url', `${fx.origin}/`, '--json']),
          )
          runs.push(Duration.toMillis(took))
          expect(code).toBe(0)
          outs.push(out)
        }
        const { links } = yield* decodeLinks(outs[0] ?? '')
        const s = score(links, gold(fx.origin))
        const median = runs.sort((a, b) => a - b)[1] ?? 0
        yield* Effect.logInfo(
          `map-accuracy recall=${s.recall.toFixed(3)} precision=${s.precision.toFixed(3)} n=${links.length} median_ms=${median.toFixed(0)} links=${links.join(' ')}`,
        )
        expect(s.precision).toBe(1)
        expect(s.recall).toBe(1)
        expect([s.precision, s.recall]).toEqual([
          scoreboardValue('map', 'precision'),
          scoreboardValue('map', 'recall'),
        ])
      }),
    ),
    120_000,
  )
})
