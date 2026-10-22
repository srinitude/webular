// Contract for the You.com peer adapter: request shape and how a recorded
// reply (trimmed from the you.com Web Search API example) maps to Output.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { HttpClient } from 'effect/http'
import { youcom } from '../../scripts/bench/peers/youcom.ts'
import { recorded } from './replay.ts'

const reply = {
  results: {
    web: [
      { url: 'https://a.test', title: 'A', snippets: ['one', 'two'], page_age: '2026-09-02' },
      { url: 'https://b.test' },
    ],
    news: [],
  },
  metadata: { latency: 0.5 },
}

const run = (reply: unknown) => {
  const { post, seen } = recorded(reply)
  const call = youcom(post, 'k', {} as HttpClient.HttpClient).search
  return (call ? call({ query: 'q' }) : Effect.die('no search job')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts the query with X-API-Key and maps title, url, snippets', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(reply)
      expect(req?.url).toBe('https://ydc-index.io/v1/search')
      expect(req?.headers).toEqual({ 'x-api-key': 'k' })
      expect(req?.body).toEqual({ query: 'q', count: 5 })
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.text).toBe('A\nhttps://a.test\none\ntwo\n\n\nhttps://b.test\n')
      expect(o.citations).toEqual([])
      expect(o.costUsd).toBe(0.005)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a reply without results fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
