// SEARCH --source contract — Wikipedia, Hacker News, and arXiv backends against
// the local fixture (WEBULAR_SOURCE_ORIGIN swaps the endpoint origin; real
// fetch, no mocks). Fixture bodies follow each API's documented response shape.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const json = (body: unknown) => () => Response.json(body)

// Each test acquires its own fixture; the test scope stops it.
const withFx = startFixture(() => ({
  '/w/api.php': (_req, url) =>
    Response.json({
      query: {
        search: [
          {
            title: `Bun (${url.searchParams.get('srsearch')})`,
            snippet: '<span class="searchmatch">Bun</span> is a &quot;runtime&quot;',
          },
        ],
      },
    }),
  '/api/v1/search': json({
    hits: [
      { objectID: '1', title: 'Show HN: Bun', url: 'https://bun.sh', story_text: null },
      { objectID: '2', title: 'Ask HN: Bun?', url: null, story_text: '<p>Thoughts?</p>' },
    ],
  }),
  '/api/query': () =>
    new Response(
      `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2610.00001v1</id><title>A  Bun
 Paper</title><summary> Fast JS. </summary></entry></feed>`,
      { headers: { 'content-type': 'application/atom+xml' } },
    ),
}))

const runSearch = (fx: Fixture, args: string[]) =>
  runCli('src/commands/search.ts', args, {
    env: { ...process.env, WEBULAR_SOURCE_ORIGIN: fx.origin },
  })

describe('webular search --source — keyless specialized sources', () => {
  test(
    'wikipedia: titles, article URLs, and tag-free snippets',
    eff(
      Effect.gen(function* () {
        const fx = yield* withFx
        const { code, out } = yield* runSearch(fx, ['bun', '--source', 'wikipedia', '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data).toEqual({
          query: 'bun',
          count: 1,
          results: [
            {
              title: 'Bun (bun)',
              url: 'https://en.wikipedia.org/wiki/Bun_(bun)',
              description: 'Bun is a "runtime"',
            },
          ],
        })
      }),
    ),
    15_000,
  )

  test(
    'hackernews: story URL, falling back to the discussion page',
    eff(
      Effect.gen(function* () {
        const fx = yield* withFx
        const { code, out } = yield* runSearch(fx, ['bun', '--source', 'hackernews', '--json'])
        expect(code).toBe(0)
        const { results } = JSON.parse(out)
        expect(results[0].url).toBe('https://bun.sh')
        expect(results[1].url).toBe('https://news.ycombinator.com/item?id=2')
        expect(results[1].description).toBe('Thoughts?')
      }),
    ),
    15_000,
  )

  test(
    'arxiv: Atom entries with whitespace collapsed',
    eff(
      Effect.gen(function* () {
        const fx = yield* withFx
        const { code, out } = yield* runSearch(fx, [
          'bun',
          '--source',
          'arxiv',
          '--limit',
          '5',
          '--json',
        ])
        expect(code).toBe(0)
        const { results } = JSON.parse(out)
        expect(results).toEqual([
          {
            title: 'A Bun Paper',
            url: 'http://arxiv.org/abs/2610.00001v1',
            description: 'Fast JS.',
          },
        ])
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 for an unknown --source',
    eff(
      Effect.gen(function* () {
        const fx = yield* withFx
        const { code, err } = yield* runSearch(fx, ['bun', '--source', 'nope'])
        expect(code).toBe(2)
        expect(err).toContain('--source')
      }),
    ),
  )
})
