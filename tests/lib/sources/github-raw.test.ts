// waybackAvailable's GitHub raw fallback (2505.15042) against a real local
// Bun.serve fixture (WEBULAR_SOURCE_ORIGIN swaps raw.githubusercontent.com's
// origin; the path stays). The archive has no snapshot of the blob URL, so the
// raw file answers: its text comes back, a body over 1 MB is rejected, and a
// slow response fails at the injected timeout.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { waybackAvailable } from '../../../src/lib/sources/archives.ts'
import { against, run } from './support.ts'

const blob = 'https://github.com/o/r/blob/main/src/a.ts'
const rawPath = '/o/r/main/src/a.ts'
const plain = (text: string) => new Response(text, { headers: { 'content-type': 'text/plain' } })
const empty = () =>
  new Response('{"archived_snapshots":{}}', { headers: { 'content-type': 'application/json' } })
const routes = (raw: () => Response | Effect.Effect<Response>) => ({
  '/wayback/available': empty,
  [rawPath]: raw,
})

const textCase = Effect.gen(function* () {
  const hits = yield* against(
    routes(() => plain('export const a = 1\n')),
    waybackAvailable(blob, 5),
  )
  expect(hits).toEqual([
    { title: `GitHub raw file ${blob}`, url: blob, description: 'export const a = 1\n' },
  ])
})

const oversizeCase = Effect.gen(function* () {
  const big = 'x'.repeat(1_048_576 + 1)
  const failure = yield* against(
    routes(() => plain(big)),
    Effect.flip(waybackAvailable(blob, 5)),
  )
  expect(String(failure)).toContain('too large')
})

const slowCase = Effect.gen(function* () {
  const slow = () => Effect.as(Effect.sleep('1 second'), plain('late'))
  const failure = yield* against(routes(slow), Effect.flip(waybackAvailable(blob, 5)), {
    WEBULAR_GITHUB_RAW_TIMEOUT_MS: '100',
  })
  expect(failure).toMatchObject({ _tag: 'FetchError', message: 'The operation timed out.' })
})

describe('waybackAvailable — GitHub raw fallback', () => {
  test('an unarchived blob url returns the raw file text', () => run(textCase))
  test('rejects a raw body over 1 MB', () => run(oversizeCase))
  test('fails when the raw response outlasts the timeout', () => run(slowCase))
})
