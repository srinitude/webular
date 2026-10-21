// Download contract (A4/B5/B23/B28): explicit dest (no random temp paths in
// output), fixed .part temp cleaned on failure, per-chunk idle timeout instead
// of a wall-clock abort, and a finite content-length precheck.
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { downloadToFile } from '../../src/lib/download.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

describe('downloadToFile — deterministic dest + stall/cap handling', () => {
  test(
    'downloads to the explicit destination and cleans its temp',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-dl-')
        const dest = join(dir, 'ok.bin')
        const result = yield* downloadToFile(`${fx.origin}/bytes?n=2048`, dest)
        expect(result.savedTo).toBe(dest)
        expect(result.bytes).toBe(2048)
        expect(existsSync(dest)).toBe(true)
        expect(existsSync(`${dest}.part`)).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'rejects a stalled stream via the idle timer, not a wall clock',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-dl-')
        const dest = join(dir, 'stall.bin')
        expect(yield* failMsg(downloadToFile(`${fx.origin}/stall`, dest, { idleMs: 200 }))).toMatch(
          /stalled/,
        )
        yield* Effect.sleep(400)
        expect(existsSync(dest)).toBe(false)
        expect(existsSync(`${dest}.part`)).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'enforces the byte cap and leaves no partial file',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-dl-')
        const dest = join(dir, 'capped.bin')
        expect(
          yield* failMsg(downloadToFile(`${fx.origin}/bytes?n=2048`, dest, { maxBytes: 100 })),
        ).toMatch(/exceed/)
        yield* Effect.sleep(100)
        expect(existsSync(dest)).toBe(false)
        expect(existsSync(`${dest}.part`)).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'concurrent downloads to ONE destination never share a temp file',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-dl-')
        const dest = join(dir, 'race.bin')
        const [a, b] = yield* Effect.all(
          [
            downloadToFile(`${fx.origin}/bytes?n=1024`, dest),
            downloadToFile(`${fx.origin}/bytes?n=4096`, dest),
          ],
          { concurrency: 'unbounded' },
        )
        expect(a.bytes).toBe(1024)
        expect(b.bytes).toBe(4096)
        expect([1024, 4096]).toContain(Bun.file(dest).size)
        const leftovers = readdirSync(dir).filter((f) => f.includes('.part'))
        expect(leftovers).toEqual([])
      }),
    ),
    15_000,
  )
})
