// BATCH contract — concurrent scrape against the local fixture (no mocks).
// Tests the user-facing command behavior that `mise run run:batch` executes.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const runBatch = (args: string[]) => runCli('src/commands/batch.ts', args)

describe('webular batch — concurrent scrape of multiple URLs (real fetch)', () => {
  test('scrapes two fixture pages and returns count === 2 with --json', async () => {
    const urlA = `${fx.origin}/a`
    const urlB = `${fx.origin}/b`
    const { code, out } = await runBatch(['--urls', `${urlA},${urlB}`, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.count).toBe(2)
    expect(data.results.length).toBe(2)
    const first = data.results.find((r: { url: string }) => r.url === urlA)
    expect(first).toBeDefined()
    expect(first.ok).toBe(true)
    expect(data.results.every((r: { url: string }) => typeof r.url === 'string')).toBe(true)
  }, 20_000)

  test('reads URLs from a file with --input', async () => {
    const tmpFile = join(tmpdir(), 'webular-batch-test-urls.txt')
    writeFileSync(tmpFile, `${fx.origin}/a\n`)
    try {
      const { code, out } = await runBatch(['--input', tmpFile, '--json'])
      expect(code).toBe(0)
      const data = JSON.parse(out)
      expect(data.count).toBe(1)
      expect(data.results[0].url).toBe(`${fx.origin}/a`)
      expect(data.results[0].ok).toBe(true)
    } finally {
      unlinkSync(tmpFile)
    }
  }, 15_000)

  test('exits with code 2 when URLs are missing', async () => {
    const { code, err } = await runBatch([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('duplicate URLs in the list scrape independently (deterministic runIds stay unique)', async () => {
    const url = `${fx.origin}/a`
    const { code, out } = await runBatch(['--urls', `${url},${url}`, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.count).toBe(2)
    expect(data.results.every((r: { ok: boolean }) => r.ok)).toBe(true)
  }, 20_000)

  test('exits with code 2 for a non-integer --concurrency', async () => {
    const { code, err } = await runBatch(['--urls', 'http://127.0.0.1:1/x', '--concurrency', 'abc'])
    expect(code).toBe(2)
    expect(err).toContain('--concurrency')
  })
})
