// Scrape determinism (A1): identical input ⇒ byte-identical --json output,
// with no wall-clock field in the schema. Runs the real command process.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

async function scrapeJson(url: string): Promise<string> {
  const { code, out } = await runCli('src/commands/scrape.ts', ['--url', url, '--json'])
  expect(code).toBe(0)
  return out
}

describe('scrape — deterministic output (A1)', () => {
  test('carries no wall-clock field', async () => {
    const data = JSON.parse(await scrapeJson(`${fx.origin}/`))
    expect('fetchedAt' in data).toBe(false)
  }, 15_000)

  test('two identical runs produce byte-identical JSON', async () => {
    const first = await scrapeJson(`${fx.origin}/a`)
    const second = await scrapeJson(`${fx.origin}/a`)
    expect(first).toBe(second)
  }, 30_000)
})
