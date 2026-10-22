// Bad urls from a server fail softly: a feed link that does not parse is
// skipped, a relative one resolves against <base href>, and a bad Location
// header settles as the redirect status instead of throwing.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { resolveFeed } from '../../src/core/feed-source.ts'
import { fetchTextWithinHost } from '../../src/core/http.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, failMsg } from '../_support/run.ts'

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title></channel></rss>`
const xml = () => new Response(RSS, { headers: { 'content-type': 'application/rss+xml' } })
const page = (head: string) => () =>
  new Response(`<html><head>${head}</head><body>hi</body></html>`, {
    headers: { 'content-type': 'text/html' },
  })
const alt = (href: string) => `<link rel="alternate" type="application/rss+xml" href="${href}">`

const fx = useFixture(() => ({
  '/badlink': page(`${alt('http://[bad')}${alt('/ok.xml')}`),
  '/based': page(`<base href="/sub/">${alt('alt.xml')}`),
  '/ok.xml': xml,
  '/sub/alt.xml': xml,
  '/badloc': () => new Response('moved', { status: 302, headers: { location: 'http://[bad' } }),
}))

test(
  'a feed link that does not parse is skipped',
  eff(
    Effect.gen(function* () {
      const found = yield* resolveFeed(`${fx.origin}/badlink`, { cache: false })
      expect(found.feedUrl).toBe(`${fx.origin}/ok.xml`)
    }),
  ),
)

test(
  'a relative feed link resolves against <base href>',
  eff(
    Effect.gen(function* () {
      const found = yield* resolveFeed(`${fx.origin}/based`, { cache: false })
      expect(found.feedUrl).toBe(`${fx.origin}/sub/alt.xml`)
    }),
  ),
)

test(
  'a bad Location header settles as the redirect status',
  eff(
    Effect.gen(function* () {
      const msg = yield* failMsg(
        fetchTextWithinHost(`${fx.origin}/badloc`, fx.origin, { cache: false }),
      )
      expect(msg).toMatch(/302/)
    }),
  ),
)
