// The opt-in bring-your-own-key tier: Brave joins `search` only when
// WEBULAR_BYOK=1 and a key is set (read through Config.Redacted); with no
// switch the key is never read, no request goes out, and the order is unchanged.
// All requests hit a local fixture server, never the network.
import { describe, expect, test } from 'bun:test'
import { Effect, Option, Redacted } from 'effect'
import { braveKey } from '../../../src/lib/sources/byok.ts'
import { freeSourceFallback } from '../../../src/lib/sources/registry.ts'
import { against, json, run } from './support.ts'

const BRAVE = JSON.stringify({
  web: {
    results: [{ title: 'Brave hit', url: 'https://example.com/b', description: 'from brave' }],
  },
})

const ask = (extra: Record<string, string>) =>
  Effect.gen(function* () {
    const seen = { token: '', calls: 0, query: '' }
    const route = (req: Request, url: URL) => {
      seen.calls += 1
      seen.token = req.headers.get('x-subscription-token') ?? ''
      seen.query = url.searchParams.get('q') ?? ''
      return json(BRAVE)
    }
    const out = yield* against(
      { '/res/v1/web/search': route },
      freeSourceFallback('search', 'effect typescript', 3).pipe(
        Effect.catch(() => Effect.succeed({ results: [], failures: [] })),
      ),
      extra,
    )
    return { out, seen }
  })

describe('byok search tier', () => {
  test(
    'with WEBULAR_BYOK=1 and BRAVE_API_KEY, Brave is asked with the key',
    () =>
      run(
        Effect.map(ask({ WEBULAR_BYOK: '1', BRAVE_API_KEY: 'brave-k' }), ({ out, seen }) => {
          expect(seen.token).toBe('brave-k')
          expect(seen.query).toBe('effect typescript')
          expect(out.results.some((h) => h.url === 'https://example.com/b')).toBe(true)
        }),
      ),
    15_000,
  )

  test(
    'without WEBULAR_BYOK a set key is ignored and Brave is never asked',
    () =>
      run(
        Effect.map(ask({ BRAVE_API_KEY: 'brave-k' }), ({ seen }) => {
          expect(seen.calls).toBe(0)
        }),
      ),
    15_000,
  )

  test('the key stays Redacted when the switch is on', () =>
    run(
      Effect.gen(function* () {
        const on = yield* against({}, braveKey, { WEBULAR_BYOK: '1', BRAVE_API_KEY: 'brave-k' })
        expect(String(on)).not.toContain('brave-k')
        expect(Option.map(on, Redacted.value)).toEqual(Option.some('brave-k'))
      }),
    ))

  test('no key is read without the switch', () =>
    run(
      Effect.map(against({}, braveKey, { BRAVE_API_KEY: 'brave-k' }), (off) =>
        expect(Option.isNone(off)).toBe(true),
      ),
    ))
})

// Every source answers 404 from the fixture except Brave, so the run's outcome
// is the list of sources it asked: the order the command used.
const outcome = (extra: Record<string, string>, braveStatus = 200) =>
  Effect.gen(function* () {
    const seen = { calls: 0 }
    const route = () => {
      seen.calls += 1
      return json(BRAVE, braveStatus)
    }
    const out = yield* against(
      { '/res/v1/web/search': route },
      freeSourceFallback('search', 'effect typescript', 3).pipe(
        Effect.map((ok) => ({ asked: [] as string[], text: JSON.stringify(ok) })),
        Effect.catch((e) =>
          Effect.succeed({
            asked: 'failures' in e ? e.failures.map((f) => f.source) : [],
            text: JSON.stringify(e),
          }),
        ),
      ),
      extra,
    )
    return { ...out, calls: seen.calls }
  })

describe('byok search tier with no key', () => {
  test(
    'switch on but no BRAVE_API_KEY and no Keychain item: same sources as a plain run, no Brave call',
    () =>
      run(
        Effect.gen(function* () {
          const plain = yield* outcome({})
          const noKey = yield* outcome({ WEBULAR_BYOK: '1' })
          expect(noKey.calls).toBe(0)
          expect(plain.calls).toBe(0)
          expect(noKey.asked).toEqual(plain.asked)
          expect(noKey.asked).not.toContain('brave')
          expect(yield* against({}, braveKey, { WEBULAR_BYOK: '1' })).toEqual(Option.none())
        }),
      ),
    15_000,
  )

  test(
    'a Brave error never carries the key into the output',
    () =>
      run(
        Effect.map(outcome({ WEBULAR_BYOK: '1', BRAVE_API_KEY: 'brave-secret-k' }, 401), (out) => {
          expect(out.calls).toBeGreaterThan(0)
          expect(out.asked).toContain('brave')
          expect(out.text).not.toContain('brave-secret-k')
        }),
      ),
    15_000,
  )
})
