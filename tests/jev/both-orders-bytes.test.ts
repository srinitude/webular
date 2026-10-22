// The position check asks one Choice twice with the options reversed, so the
// posted bytes must carry two option orders; canonical() keeps a Choice's
// `criteria` in insertion order while every other object still sorts its keys.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import {
  bothOrders,
  cacheKey,
  choice,
  menu,
  requestBytes,
} from '../../src/lib/jev/payload/index.ts'

const MODEL = 'jev-test'
const build = () => bothOrders('k', choice('pick', menu('zeta', ['alpha', 'mid'])))
const Body = Schema.fromJsonString(
  Schema.Struct({
    questions: Schema.Record(
      Schema.String,
      Schema.Struct({ criteria: Schema.Record(Schema.String, Schema.Unknown) }),
    ),
  }),
)
const optionOrder = (body: string, key: string): string[] =>
  Effect.runSync(
    Schema.decodeUnknownEffect(Body)(body).pipe(
      Effect.map((b) => Object.keys(b.questions[key]?.criteria ?? {})),
    ),
  )

test('k and k_swapped post their options in reverse order, none last', () => {
  const body = requestBytes(MODEL, {}, build())
  expect(optionOrder(body, 'k')).toEqual(['zeta', 'alpha', 'mid', 'none'])
  expect(optionOrder(body, 'k_swapped')).toEqual(['mid', 'alpha', 'zeta', 'none'])
})

test('rebuilding the same menu gives byte-equal requests', () => {
  expect(requestBytes(MODEL, { b: 1, a: 2 }, build())).toBe(
    requestBytes(MODEL, { a: 2, b: 1 }, build()),
  )
})

// The replay file name is this key, so a recorded answer never answers a request
// whose options sit in another order: the changed request misses and must be re-recorded.
test('a reordered menu gets another replay key', () => {
  const ask = (opts: string[]) =>
    cacheKey(requestBytes(MODEL, {}, { k: choice('pick', menu(opts[0] ?? '', opts)) }))
  expect(ask(['zeta', 'alpha'])).not.toBe(ask(['alpha', 'zeta']))
})
