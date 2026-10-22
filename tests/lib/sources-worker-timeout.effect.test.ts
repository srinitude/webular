// A parse worker that never replies must not hold its pool permit forever:
// each parse times out after WEBULAR_PARSE_TIMEOUT_MS, its worker is
// terminated, and the next parse starts a fresh worker.
import { expect, test } from 'bun:test'
import { Cause, ConfigProvider, Effect, Exit, Layer, Option } from 'effect'
import { ParsePool, parseArticleText } from '../../src/lib/sources.ts'
import { eff } from '../_support/run.ts'

const PARSES = 6 // more than the pool's permits, so one leaked permit blocks a parse

// A pool of its own whose parses time out after 50 ms. Layer.fresh: eff's
// testLayer already built ParsePool.layer, and Effect.provide reuses that memo.
const shortPool = Layer.fresh(ParsePool.layer).pipe(
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBULAR_PARSE_TIMEOUT_MS: '50' })),
  ),
)

// Swaps the global Worker for one that takes messages and never answers.
const silentWorkers = Effect.acquireRelease(
  Effect.sync(() => {
    const seen = { real: globalThis.Worker, started: 0, terminated: 0 }
    globalThis.Worker = class {
      onmessage = null
      onerror = null
      constructor() {
        seen.started++
      }
      postMessage() {}
      ref() {}
      unref() {}
      terminate() {
        seen.terminated++
      }
    } as unknown as typeof Worker
    return seen
  }),
  (seen) =>
    Effect.sync(() => {
      globalThis.Worker = seen.real
    }),
)

test(
  'silent workers time out, free their permits, and are replaced',
  eff(
    Effect.gen(function* () {
      const seen = yield* silentWorkers
      const exits = yield* Effect.forEach(
        Array.from({ length: PARSES }, (_, n) => `<p>page ${n}</p>`),
        (html) => Effect.exit(parseArticleText(html)),
        { concurrency: PARSES },
      ).pipe(Effect.provide(shortPool), Effect.timeoutOption(3_000))
      expect(Option.isSome(exits)).toBe(true)
      for (const exit of Option.getOrElse(exits, () => [])) {
        expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain('TimeoutError')
      }
      expect(seen.started).toBe(PARSES)
      expect(seen.terminated).toBe(PARSES)
    }),
  ),
  10_000,
)
