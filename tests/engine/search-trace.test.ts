// WEBULAR_TRACE=1 prints one JSON line of per-source timings on stderr per search;
// unset, search prints nothing extra.
import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { searchEffect } from '../../src/lib/search-chain.ts'
import { SETTLE_GRACE_MS, type SourceRunner, traceLine } from '../../src/lib/search-source-run.ts'
import { eff } from '../_support/run.ts'

const runner: SourceRunner = (s) =>
  Effect.succeed(s === 'wikipedia' ? [{ title: 't', url: 'https://a.dev', description: '' }] : [])

// What one search writes to stderr, with the env var as given.
const stderrOf = (trace: string | undefined) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const written: string[] = []
      const real = process.stderr.write
      process.stderr.write = ((s: string) => (written.push(s), true)) as typeof real
      return { written, real }
    }),
    ({ written }) =>
      searchEffect('web', 'bun runtime', 5, { runSource: runner }).pipe(
        Effect.provide(
          ConfigProvider.layer(ConfigProvider.fromEnvRecord(trace ? { WEBULAR_TRACE: trace } : {})),
        ),
        Effect.as(written),
      ),
    ({ real }) =>
      Effect.sync(() => {
        process.stderr.write = real
      }),
  )

describe('traceLine', () => {
  test('offsets are ms since search start; no hit gives null', () => {
    const rows = [
      { source: 'a', status: 'ok', ms: 30, firstHitAt: 1040, endedAt: 1040 },
      { source: 'b', status: 'timeout', ms: 800, firstHitAt: null, endedAt: 1810 },
    ] as const
    expect(traceLine(1000, rows, 1200)).toBe(
      JSON.stringify({
        trace: 'search',
        judgeWaitMs: 200,
        settleEndMs: 40 + SETTLE_GRACE_MS,
        sources: {
          a: { status: 'ok', ms: 30, firstHitMs: 40, settleMs: 40 },
          b: { status: 'timeout', ms: 800, firstHitMs: null, settleMs: 810 },
        },
      }),
    )
    expect(traceLine(1000, [], null)).toBe(
      '{"trace":"search","judgeWaitMs":null,"settleEndMs":null,"sources":{}}',
    )
  })
})

describe('WEBULAR_TRACE', () => {
  test(
    'on: one JSON line on stderr',
    eff(
      Effect.gen(function* () {
        const lines = (yield* stderrOf('1')).join('').trim().split('\n')
        expect(lines).toHaveLength(1)
        expect(lines[0]).toStartWith('{"trace":"search","judgeWaitMs":null,')
        expect(lines[0]).toContain('"wikipedia":{"status":"ok"')
      }),
    ),
  )
  test(
    'off: nothing on stderr',
    eff(Effect.map(stderrOf(undefined), (written) => expect(written).toEqual([]))),
  )
})
