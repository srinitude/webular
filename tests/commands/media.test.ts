// MEDIA contract — real download from the deterministic local fixture (no mocks).
// Tests user-facing behavior of `media --url ... --download -o <tmp> --json`.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, statSync, unlinkSync } from 'node:fs'
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

const runMedia = (args: string[]) => runCli('src/commands/media.ts', args)

describe('webular media — download bytes from a real URL', () => {
  test('downloads a file and reports savedTo + bytes with --json', async () => {
    const dest = join(tmpdir(), `webular-media-test-${Date.now()}.bin`)
    const { code, out } = await runMedia([
      '--url',
      `${fx.origin}/bytes?n=2048`,
      '--download',
      '-o',
      dest,
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.savedTo).toBe(dest)
    expect(data.bytes).toBe(2048)
    expect(existsSync(dest)).toBe(true)
    expect(statSync(dest).size).toBe(2048)
    unlinkSync(dest)
  }, 15_000)

  test('exits with code 2 when --url is missing', async () => {
    const { code, err } = await runMedia(['--download'])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 for a non-integer --max-bytes', async () => {
    const { code, err } = await runMedia([
      '--url',
      `${fx.origin}/bytes?n=16`,
      '--download',
      '-o',
      '/tmp/webular-nan.bin',
      '--max-bytes',
      'abc',
    ])
    expect(code).toBe(2)
    expect(err).toContain('--max-bytes')
  })

  test('exits with code 2 when -o is omitted (no hidden temp paths)', async () => {
    const { code, err } = await runMedia(['--url', `${fx.origin}/bytes?n=64`, '--download'])
    expect(code).toBe(2)
    expect(err).toContain('-o')
  }, 15_000)
})
