// FEED contract — RSS 2.0 and Atom 1.0 parsing against the deterministic local
// fixture (real fetch, no mocks). Tests what `mise run run:feed` executes.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture RSS</title>
<item><title>First &amp; best</title><link>https://example.com/1</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description>One</description></item>
<item><title>Second</title><link>https://example.com/2</link><description>Two</description></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Fixture Atom</title>
<entry><title>Entry A</title><link rel="self" href="https://example.com/self"/><link href="https://example.com/a"/><updated>2026-10-19T10:00:00Z</updated><summary>Alpha</summary></entry>
</feed>`

const xml = (body: string, type: string) => () =>
  new Response(body, { headers: { 'content-type': type } })

const withFx = startFixture(() => ({
  '/rss.xml': xml(RSS, 'application/rss+xml'),
  '/atom.xml': xml(ATOM, 'application/atom+xml'),
}))
// No feed paths at all, so the same-origin guesses fail too.
const withEmpty = startFixture(() => ({}))

const runFeed = (args: string[]) => runCli('src/commands/feed.ts', args)

const rssCase = Effect.gen(function* () {
  const fx = yield* withFx
  const { code, out } = yield* runFeed([`${fx.origin}/rss.xml`, '--json'])
  expect(code).toBe(0)
  const data = JSON.parse(out)
  expect(data.title).toBe('Fixture RSS')
  expect(data.count).toBe(2)
  expect(data.items[0]).toEqual({
    title: 'First & best',
    url: 'https://example.com/1',
    published: 'Mon, 19 Oct 2026 10:00:00 GMT',
    summary: 'One',
  })
})

const atomCase = Effect.gen(function* () {
  const fx = yield* withFx
  const { code, out } = yield* runFeed(['--url', `${fx.origin}/atom.xml`, '--json'])
  expect(code).toBe(0)
  const data = JSON.parse(out)
  expect(data.title).toBe('Fixture Atom')
  expect(data.items[0].url).toBe('https://example.com/a')
  expect(data.items[0].published).toBe('2026-10-19T10:00:00Z')
})

const limitCase = Effect.gen(function* () {
  const fx = yield* withFx
  const { code, out } = yield* runFeed([`${fx.origin}/rss.xml`, '--limit', '1'])
  expect(code).toBe(0)
  expect(out).toContain('First & best')
  expect(out).not.toContain('Second')
})

const missingUrlCase = Effect.gen(function* () {
  const { code, err } = yield* runFeed([])
  expect(code).toBe(2)
  expect(err).toContain('missing')
})

// A failed chain ends at the free feed search. WEBULAR_SOURCE_ORIGIN points it
// at the same empty fixture, so the run never waits on feedsearch.dev.
const fetchFailureCase = Effect.gen(function* () {
  const empty = yield* withEmpty
  const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
  const env = { HOME, WEBULAR_SOURCE_ORIGIN: empty.origin, WEBULAR_SOURCE_GAP_MS: '0' }
  const { code } = yield* runCli('src/commands/feed.ts', [`${empty.origin}/nope.xml`, '--json'], {
    env,
  })
  expect(code).toBe(1)
  expect(empty.hits('/api/v1/search')).toBe(1)
})

describe('webular feed — read an RSS or Atom feed (real fetch)', () => {
  test('parses RSS 2.0 items as JSON', eff(rssCase), 15_000)
  test('parses Atom 1.0 entries, preferring the alternate link', eff(atomCase), 15_000)
  test('respects --limit and renders human text by default', eff(limitCase), 15_000)
  test('exits with code 2 when url is missing', eff(missingUrlCase))
  test('exits with code 1 on a fetch failure', eff(fetchFailureCase), 15_000)
})
