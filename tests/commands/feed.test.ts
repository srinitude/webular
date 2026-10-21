// FEED contract — RSS 2.0 and Atom 1.0 parsing against the deterministic local
// fixture (real fetch, no mocks). Tests what `mise run run:feed` executes.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture RSS</title>
<item><title>First &amp; best</title><link>https://example.com/1</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description>One</description></item>
<item><title>Second</title><link>https://example.com/2</link><description>Two</description></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Fixture Atom</title>
<entry><title>Entry A</title><link rel="self" href="https://example.com/self"/><link href="https://example.com/a"/><updated>2026-10-19T10:00:00Z</updated><summary>Alpha</summary></entry>
</feed>`

const xml = (body: string, type: string) => () =>
  new Response(body, { headers: { 'content-type': type } })

let fx: Fixture
beforeAll(() => {
  fx = startFixture(() => ({
    '/rss.xml': xml(RSS, 'application/rss+xml'),
    '/atom.xml': xml(ATOM, 'application/atom+xml'),
  }))
})
afterAll(() => fx.stop())

const runFeed = (args: string[]) => runCli('src/commands/feed.ts', args)

describe('webular feed — read an RSS or Atom feed (real fetch)', () => {
  test('parses RSS 2.0 items as JSON', async () => {
    const { code, out } = await runFeed([`${fx.origin}/rss.xml`, '--json'])
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
  }, 15_000)

  test('parses Atom 1.0 entries, preferring the alternate link', async () => {
    const { code, out } = await runFeed(['--url', `${fx.origin}/atom.xml`, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.title).toBe('Fixture Atom')
    expect(data.items[0].url).toBe('https://example.com/a')
    expect(data.items[0].published).toBe('2026-10-19T10:00:00Z')
  }, 15_000)

  test('respects --limit and renders human text by default', async () => {
    const { code, out } = await runFeed([`${fx.origin}/rss.xml`, '--limit', '1'])
    expect(code).toBe(0)
    expect(out).toContain('First & best')
    expect(out).not.toContain('Second')
  }, 15_000)

  test('exits with code 2 when url is missing', async () => {
    const { code, err } = await runFeed([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 1 on a fetch failure', async () => {
    const { code } = await runFeed([`${fx.origin}/nope.xml`, '--json'])
    expect(code).toBe(1)
  }, 15_000)
})
