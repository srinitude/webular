// FEED accuracy eval: RSS 2.0 and Atom 1.0 fixtures with CDATA, entity-escaped
// titles, relative links (root-relative and path-relative), a guid-only item, a
// dc:date item and missing dates, scored field by field against a gold item list
// written from the fixture design. Determinism: the same feed fetched twice
// yields byte-identical output.
import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const xml = (body: string, type: string) => () =>
  new Response(body, { headers: { 'content-type': type } })

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Dev &amp; Ops Weekly</title><link>https://example.com/</link>
<item><title><![CDATA[Cats & <dogs>]]></title><link>/posts/1</link>
<pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[Tom & Jerry   chase]]></description></item>
<item><title>Entity &amp; &quot;quote&quot;</title><link>https://example.com/abs?a=1&amp;b=2</link><description>No date here</description></item>
<item><title>Dated by DC</title><link>posts/3</link><dc:date>2026-10-01T00:00:00Z</dc:date></item>
<item><title>Guid only</title><guid isPermaLink="true">https://example.com/g4</guid><description>Fourth</description></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Gold</title>
<entry><title type="html"><![CDATA[Entry <i>A</i>]]></title>
<link rel="self" href="/atom.xml"/><link rel="enclosure" href="/files/a.mp3"/><link rel="alternate" href="/entries/a"/>
<updated>2026-10-19T12:00:00Z</updated><published>2026-10-18T09:00:00Z</published><content type="text">Alpha body</content></entry>
<entry><title>Entry B</title><link href="https://example.com/b"/><summary>R&amp;D notes</summary></entry>
<entry><title>Entry C</title><link href="c"/><updated>2026-10-17T08:00:00Z</updated><summary><![CDATA[Gamma & more]]></summary></entry>
</feed>`

const fx = useFixture(() => ({
  '/feed/rss.xml': xml(RSS, 'application/rss+xml'),
  '/atom.xml': xml(ATOM, 'application/atom+xml'),
}))

type Item = { title: string; url: string; published: string; summary: string }
const FIELDS = ['title', 'url', 'published', 'summary'] as const

// Gold, from the fixture design: markup in CDATA titles stays literal text, entities
// decode, whitespace collapses, relative links resolve against the feed URL, a missing
// date is the empty string, and Atom prefers rel="alternate" for the link and
// published over updated.
const goldRss = (o: string): Item[] => [
  {
    title: 'Cats & <dogs>',
    url: `${o}/posts/1`,
    published: 'Mon, 19 Oct 2026 10:00:00 GMT',
    summary: 'Tom & Jerry chase',
  },
  {
    title: 'Entity & "quote"',
    url: 'https://example.com/abs?a=1&b=2',
    published: '',
    summary: 'No date here',
  },
  {
    title: 'Dated by DC',
    url: `${o}/feed/posts/3`,
    published: '2026-10-01T00:00:00Z',
    summary: '',
  },
  { title: 'Guid only', url: 'https://example.com/g4', published: '', summary: 'Fourth' },
]
const goldAtom = (o: string): Item[] => [
  {
    title: 'Entry <i>A</i>',
    url: `${o}/entries/a`,
    published: '2026-10-18T09:00:00Z',
    summary: 'Alpha body',
  },
  { title: 'Entry B', url: 'https://example.com/b', published: '', summary: 'R&D notes' },
  {
    title: 'Entry C',
    url: `${o}/c`,
    published: '2026-10-17T08:00:00Z',
    summary: 'Gamma & more',
  },
]

const Feed = Schema.Struct({
  title: Schema.String,
  count: Schema.Number,
  items: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      url: Schema.String,
      published: Schema.String,
      summary: Schema.String,
    }),
  ),
})
const decodeFeed = Schema.decodeUnknownEffect(Schema.fromJsonString(Feed))

const runFeed = (path: string) =>
  Effect.gen(function* () {
    const { code, out } = yield* runCli('src/commands/feed.ts', [
      '--url',
      `${fx.origin}${path}`,
      '--json',
    ])
    expect(code).toBe(0)
    return out
  })

// One point per correct field; the pass rate is points over fields in the gold list.
const misses = (got: readonly Item[], want: Item[]) =>
  want
    .flatMap((w, i) => FIELDS.map((f) => ({ f, i, ok: got[i]?.[f] === w[f] })))
    .filter((p) => !p.ok)

describe('webular feed — accuracy against a gold item list', () => {
  for (const [name, path, title, gold] of [
    ['rss', '/feed/rss.xml', 'Dev & Ops Weekly', goldRss],
    ['atom', '/atom.xml', 'Atom Gold', goldAtom],
  ] as const) {
    test(
      `${name}: field pass rate and determinism`,
      eff(
        Effect.gen(function* () {
          const first = yield* runFeed(path)
          const second = yield* runFeed(path)
          const data = yield* decodeFeed(first)
          const want = gold(fx.origin)
          const missed = misses(data.items, want)
          const total = want.length * FIELDS.length
          yield* Effect.logInfo(
            `feed-accuracy ${name} pass=${((total - missed.length) / total).toFixed(3)} (${total - missed.length}/${total}) items=${data.count}/${want.length} deterministic=${first === second} misses=${JSON.stringify(missed)}`,
          )
          expect(data.title).toBe(title)
          expect(data.count).toBe(want.length)
          expect(missed).toEqual([])
          expect(second).toBe(first)
        }),
      ),
      60_000,
    )
  }
})
