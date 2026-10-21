// Download contract (A4/B5/B23/B28): explicit dest (no random temp paths in
// output), fixed .part temp cleaned on failure, a resetting idle timeout instead
// of a wall-clock abort, and a finite content-length precheck.
import { describe, expect, test } from 'bun:test'
import { Clock, Effect, FileSystem, Path } from 'effect'
import { downloadToFile } from '../../src/lib/download.ts'
import { startFixture, useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

// A fresh temp dir, the destination inside it, and the file system to inspect it.
const tmpDest = (name: string) =>
  Effect.gen(function* () {
    const dir = yield* tmpDir('webular-dl-')
    const path = yield* Path.Path
    return { dir, dest: path.join(dir, name), fs: yield* FileSystem.FileSystem }
  })

describe('downloadToFile — deterministic dest + stall/cap handling', () => {
  test(
    'downloads to the explicit destination and cleans its temp',
    eff(
      Effect.gen(function* () {
        const { dest, fs } = yield* tmpDest('ok.bin')
        const result = yield* downloadToFile(`${fx.origin}/bytes?n=2048`, dest)
        expect(result.savedTo).toBe(dest)
        expect(result.bytes).toBe(2048)
        expect(yield* fs.exists(dest)).toBe(true)
        expect(yield* fs.exists(`${dest}.part`)).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'rejects a stalled stream via the idle timer, not a wall clock',
    eff(
      Effect.gen(function* () {
        const { dest, fs } = yield* tmpDest('stall.bin')
        expect(yield* failMsg(downloadToFile(`${fx.origin}/stall`, dest, { idleMs: 200 }))).toBe(
          'download stalled (no data for 200ms)',
        )
        yield* Effect.sleep(400)
        expect(yield* fs.exists(dest)).toBe(false)
        expect(yield* fs.exists(`${dest}.part`)).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'enforces the byte cap and leaves no partial file',
    eff(
      Effect.gen(function* () {
        const { dir, dest, fs } = yield* tmpDest('capped.bin')
        expect(
          yield* failMsg(downloadToFile(`${fx.origin}/bytes?n=2048`, dest, { maxBytes: 100 })),
        ).toMatch(/exceed/)
        yield* Effect.sleep(100)
        expect(yield* fs.readDirectory(dir)).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'concurrent downloads to ONE destination never share a temp file',
    eff(
      Effect.gen(function* () {
        const { dir, dest, fs } = yield* tmpDest('race.bin')
        const [a, b] = yield* Effect.all(
          [
            downloadToFile(`${fx.origin}/bytes?n=1024`, dest),
            downloadToFile(`${fx.origin}/bytes?n=4096`, dest),
          ],
          { concurrency: 2 },
        )
        expect(a.bytes).toBe(1024)
        expect(b.bytes).toBe(4096)
        expect([1024, 4096]).toContain(Number((yield* fs.stat(dest)).size))
        expect(yield* fs.readDirectory(dir)).toEqual(['race.bin'])
      }),
    ),
    15_000,
  )
})

const CHUNKS = 100

// CHUNKS separate writes, 2ms apart, so the reader sees many chunks.
const chunkRoutes = () => ({
  '/chunks': () => {
    const sent = { n: 0 }
    const body = new ReadableStream<Uint8Array>({
      pull: (c) =>
        Effect.runPromise(
          Effect.sleep(2).pipe(
            Effect.andThen(
              Effect.sync(() => (sent.n++ < CHUNKS ? c.enqueue(new Uint8Array(64)) : c.close())),
            ),
          ),
        ),
    })
    return new Response(body, { headers: { 'content-type': 'application/octet-stream' } })
  },
})

// Counts every timer the body arms (Effect.sleep and timeouts go through Clock.sleep).
const countTimers = <A, E, R>(body: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const base = yield* Clock.Clock
    const armed = { n: 0 }
    const clock: Clock.Clock = {
      currentTimeMillisUnsafe: () => base.currentTimeMillisUnsafe(),
      currentTimeMillis: base.currentTimeMillis,
      currentTimeNanosUnsafe: () => base.currentTimeNanosUnsafe(),
      currentTimeNanos: base.currentTimeNanos,
      monotonicTimeNanosUnsafe: () => base.monotonicTimeNanosUnsafe(),
      monotonicTimeNanos: base.monotonicTimeNanos,
      sleep: (d) =>
        Effect.suspend(() => {
          armed.n += 1
          return base.sleep(d)
        }),
    }
    const value = yield* Effect.provideService(body, Clock.Clock, clock)
    return { value, timers: armed.n }
  })

// Measured: 101 timers for 100 chunks with one timeout per chunk read; 2 with
// one idle deadline per download (the connect timeout plus the idle watchdog).
describe('downloadToFile — one idle timer per download', () => {
  test(
    'arms a bounded number of timers however many chunks arrive',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(chunkRoutes)
        const { dest } = yield* tmpDest('chunks.bin')
        const run = yield* countTimers(downloadToFile(`${local.origin}/chunks`, dest))
        expect(run.value.bytes).toBe(CHUNKS * 64)
        yield* Effect.logInfo(`timers armed for ${CHUNKS} chunks: ${run.timers}`)
        expect(run.timers).toBeLessThan(5)
      }),
    ),
    15_000,
  )
})
