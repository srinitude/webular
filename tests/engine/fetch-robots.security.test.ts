// Commands that always obey robots.txt (answer and research sources, feed) never
// fetch a disallowed page: not as the named url, and not as a redirect hop.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { resolveFeed } from '../../src/core/feed-source.ts'
import { fetchSources } from '../../src/lib/sources.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, failMsg } from '../_support/run.ts'

const page =
  '<html><title>P</title><body><article><p>Private text here.</p></article></body></html>'
const fx = useFixture((origin) => ({
  '/robots.txt': () => new Response('User-agent: *\nDisallow: /private'),
  '/private': () => new Response(page, { headers: { 'content-type': 'text/html' } }),
  '/hop': () => new Response(null, { status: 302, headers: { location: `${origin}/private` } }),
}))

test(
  'answer and research sources skip a disallowed url and a disallowed redirect hop',
  eff(
    Effect.gen(function* () {
      // Typed urls (answer --urls), so the private-address guard lets the local fixture through.
      const { entries, errors } = yield* fetchSources(
        [
          { title: 'direct', url: `${fx.origin}/private` },
          { title: 'hop', url: `${fx.origin}/hop` },
        ],
        15_000,
        Number.POSITIVE_INFINITY,
        true,
      )
      expect(entries).toEqual([])
      expect(errors.map((e) => e.reason).join(' ')).toContain('robots.txt disallows')
      expect(fx.hits('/private')).toBe(0)
    }),
  ),
  30_000,
)

test(
  'feed never fetches a disallowed url through a redirect',
  eff(
    Effect.gen(function* () {
      yield* failMsg(resolveFeed(`${fx.origin}/hop`))
      expect(fx.hits('/private')).toBe(0)
    }),
  ),
  30_000,
)
