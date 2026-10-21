// MEDIA contract — real download from the deterministic local fixture (no mocks).
// Tests user-facing behavior of `media --url ... --download -o <tmp> --json`.
import { describe, expect, test } from 'bun:test'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runMedia = (args: string[]) => runCli('src/commands/media.ts', args)

describe('webular media — download bytes from a real URL', () => {
  test(
    'downloads a file and reports savedTo + bytes with --json',
    eff(
      Effect.gen(function* () {
        const dest = join(yield* tmpDir('webular-'), 'media.bin')
        const { code, out } = yield* runMedia([
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
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when --url is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runMedia(['--download'])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test(
    'exits with code 2 for a non-integer --max-bytes',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runMedia([
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
      }),
    ),
  )

  test(
    'exits with code 2 when -o is omitted (no hidden temp paths)',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runMedia(['--url', `${fx.origin}/bytes?n=64`, '--download'])
        expect(code).toBe(2)
        expect(err).toContain('-o')
      }),
    ),
    15_000,
  )
})
