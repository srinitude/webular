// Bucket B contract: resource-limit guards (batch URL ceiling, download cap).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const run = (file: string, args: string[]) => runCli(`src/commands/${file}`, args)

describe('resource-limit hardening', () => {
  test('batch rejects more than 1000 URLs', async () => {
    const urls = Array.from({ length: 1001 }, (_, i) => `https://example.com/${i}`).join(',')
    const { code, err } = await run('batch.ts', ['--urls', urls, '--json'])
    expect(code).toBe(2)
    expect(err.toLowerCase()).toContain('too many')
  })

  test('media download enforces --max-bytes', async () => {
    const args = [
      '--url',
      `${fx.origin}/bytes?n=2048`,
      '--download',
      '--max-bytes',
      '5',
      '-o',
      '/tmp/webular-cap.bin',
    ]
    const { code, err } = await run('media.ts', args)
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toMatch(/max|exceed/)
  }, 15_000)
})
