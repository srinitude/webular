// Download contract (A4/B5/B23/B28): explicit dest (no random temp paths in
// output), fixed .part temp cleaned on failure, per-chunk idle timeout instead
// of a wall-clock abort, and a finite content-length precheck.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadToFile } from '../../src/lib/download.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
let dir: string
beforeAll(() => {
  fx = startFixture(defaultRoutes)
  dir = mkdtempSync(join(tmpdir(), 'webular-dl-'))
})
afterAll(() => {
  fx.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('downloadToFile — deterministic dest + stall/cap handling', () => {
  test('downloads to the explicit destination and cleans its temp', async () => {
    const dest = join(dir, 'ok.bin')
    const result = await downloadToFile(`${fx.origin}/bytes?n=2048`, dest)
    expect(result.savedTo).toBe(dest)
    expect(result.bytes).toBe(2048)
    expect(existsSync(dest)).toBe(true)
    expect(existsSync(`${dest}.part`)).toBe(false)
  }, 15_000)

  test('rejects a stalled stream via the idle timer, not a wall clock', async () => {
    const dest = join(dir, 'stall.bin')
    expect(downloadToFile(`${fx.origin}/stall`, dest, { idleMs: 200 })).rejects.toThrow(/stalled/)
    await Bun.sleep(400)
    expect(existsSync(dest)).toBe(false)
    expect(existsSync(`${dest}.part`)).toBe(false)
  }, 15_000)

  test('enforces the byte cap and leaves no partial file', async () => {
    const dest = join(dir, 'capped.bin')
    expect(downloadToFile(`${fx.origin}/bytes?n=2048`, dest, { maxBytes: 100 })).rejects.toThrow(
      /exceed/,
    )
    await Bun.sleep(100)
    expect(existsSync(dest)).toBe(false)
    expect(existsSync(`${dest}.part`)).toBe(false)
  }, 15_000)

  test('concurrent downloads to ONE destination never share a temp file', async () => {
    const dest = join(dir, 'race.bin')
    const [a, b] = await Promise.all([
      downloadToFile(`${fx.origin}/bytes?n=1024`, dest),
      downloadToFile(`${fx.origin}/bytes?n=4096`, dest),
    ])
    expect(a.bytes).toBe(1024)
    expect(b.bytes).toBe(4096)
    expect([1024, 4096]).toContain(Bun.file(dest).size)
    const leftovers = readdirSync(dir).filter((f) => f.includes('.part'))
    expect(leftovers).toEqual([])
  }, 15_000)
})
