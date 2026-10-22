// The crawl root goes through the robots gate: a root that robots.txt
// disallows is never fetched, read, or indexed (src/lib/AGENTS.md).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { bfsCrawl } from '../../src/lib/crawl.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const hits = { root: 0 }
const fx = useFixture(() => ({
  '/robots.txt': () => Effect.succeed(new Response('User-agent: *\nDisallow: /')),
  '/': () =>
    Effect.sync(() => {
      hits.root++
      return new Response('<html><title>Root</title><a href="/a">a</a></html>', {
        headers: { 'content-type': 'text/html' },
      })
    }),
}))

test(
  'a disallowed crawl root is never fetched',
  eff(
    Effect.gen(function* () {
      const { pages, errors } = yield* bfsCrawl(`${fx.origin}/`, {
        limit: 5,
        depth: 1,
        concurrency: 1,
      })
      expect(hits.root).toBe(0)
      expect(pages).toEqual([])
      expect(errors[0]?.reason).toContain('robots')
    }),
  ),
  30_000,
)
