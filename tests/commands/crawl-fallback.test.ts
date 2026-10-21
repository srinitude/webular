// CRAWL free-source fallback (2603.01548), against a real local Bun.serve
// fixture. The site path 404s, so crawl's root fetch fails and it asks
// Common Crawl's index, which answers with the site's archived URLs. No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { archived } from '../_support/archive-fixture.ts'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const crawl = eff(
  Effect.gen(function* () {
    const { site, urls, env } = yield* archived
    const run = yield* runCli('src/commands/crawl.ts', ['--url', site, '--json'], { env })
    expect(run.code).toBe(0)
    const result = JSON.parse(run.out)
    expect(result.pages.map((p: { url: string }) => p.url)).toEqual(urls)
  }),
)

describe('webular crawl — free-source fallback', () => {
  test('a failing root fetch falls back to Common Crawl', crawl, 45_000)
})
