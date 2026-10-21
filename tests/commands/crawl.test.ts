// CRAWL contract — real BFS crawl against the deterministic local fixture (no mocks).
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runCrawl = (args: string[]) => runCli('src/commands/crawl.ts', args)

describe('webular crawl — recursive BFS crawl (real fetch)', () => {
  test(
    'crawls 1 page from the fixture with --json',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runCrawl(['--url', `${fx.origin}/`, '--limit', '1', '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.count).toBe(1)
        expect(data.pages[0].url).toContain('127.0.0.1')
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when URL is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runCrawl([])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test(
    '--depth 0 crawls exactly the root page',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runCrawl([
          '--url',
          `${fx.origin}/`,
          '--depth',
          '0',
          '--limit',
          '10',
          '--json',
        ])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.count).toBe(1)
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 for a non-integer --limit',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runCrawl(['--url', `${fx.origin}/`, '--limit', 'abc'])
        expect(code).toBe(2)
        expect(err).toContain('--limit')
      }),
    ),
  )
})
