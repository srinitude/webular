// Contract for the Valyu peer adapter: request shape and how a recorded reply
// (trimmed from the docs.valyu.ai search example) maps to Output.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { HttpClient } from 'effect/http'
import { valyu } from '../../scripts/bench/peers/valyu.ts'
import { recorded } from './replay.ts'

const reply = {
  success: true,
  error: null,
  tx_id: 'tx_1',
  query: 'q',
  results: [
    { title: 'Source 1', url: 'https://a.test', content: 'Text 1.', price: 0.000625 },
    { url: 'https://b.test', price: 0.0003125 },
  ],
  results_by_source: { web: 2 },
  total_deduction_dollars: 0.0009375,
  total_characters: 14,
}

const run = (reply: unknown) => {
  const { post, seen } = recorded(reply)
  const call = valyu(post, 'k', {} as HttpClient.HttpClient).search
  return (call ? call({ query: 'q' }) : Effect.die('no search job')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts web-only search with x-api-key and bills the reported cost', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(reply)
      expect(req?.url).toBe('https://api.valyu.ai/v1/search')
      expect(req?.headers).toEqual({ 'x-api-key': 'k' })
      expect(req?.body).toEqual({ query: 'q', search_type: 'web', max_num_results: 5 })
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.text).toBe('Source 1\nhttps://a.test\nText 1.\n\n\nhttps://b.test\n')
      expect(o.costUsd).toBe(0.0009375)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a reply missing the cost fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ results: [] }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
