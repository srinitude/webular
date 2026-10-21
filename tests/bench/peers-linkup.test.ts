// Contract for the Linkup peer adapter: request shape per output type and
// how recorded replies (trimmed from docs.linkup.so examples) map to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import { linkup } from '../../scripts/bench/peers/linkup.ts'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'

interface Req {
  url: string
  headers: Record<string, string>
  body: object
}

const searchReply = {
  results: [
    { type: 'text', name: 'Report', url: 'https://a.test', content: 'Revenue rose.' },
    { type: 'text', url: 'https://b.test' },
  ],
}
const answerReply = {
  answer: 'Revenue was $245.1 billion.',
  sources: [
    { name: 'Report', url: 'https://a.test', snippet: 'Revenue rose.' },
    { name: 'B', url: 'https://b.test' },
  ],
}

// A Post that replays one recorded reply through the real schema decode.
const run = (recorded: unknown, job: 'search' | 'answer') => {
  const seen: Req[] = []
  const post: Post = (url, headers, body, schema) => {
    seen.push({ url, headers, body })
    return Schema.decodeUnknownEffect(schema)(recorded).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  const call = linkup(post, 'k', {} as HttpClient.HttpClient)[job]
  return (call ? call({ query: 'q' }) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts searchResults at fast depth with Bearer and maps results', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search')
      expect(req?.url).toBe('https://api.linkup.so/v1/search')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({
        q: 'q',
        depth: 'fast',
        outputType: 'searchResults',
        maxResults: 5,
      })
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.text).toBe('Report\nhttps://a.test\nRevenue rose.\n\n\nhttps://b.test\n')
      expect(o.costUsd).toBe(0.005)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('answer posts sourcedAnswer and maps sources to citations', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(answerReply, 'answer')
      expect(req?.body).toMatchObject({ q: 'q', outputType: 'sourcedAnswer' })
      expect(o.text).toBe('Revenue was $245.1 billion.')
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.citations).toEqual([
        { url: 'https://a.test', text: 'Revenue rose.' },
        { url: 'https://b.test', text: '' },
      ])
      expect(o.costUsd).toBe(0.005)
    }),
  ))

test('a reply missing results fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }, 'search'))
      expect(e._tag).toBe('BenchError')
    }),
  ))
