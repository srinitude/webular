// Contract for the Nimble peer adapter: request shape per endpoint and how
// recorded replies (trimmed from docs.nimbleway.com examples) map to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { nimble } from '../../scripts/bench/peers/nimble.ts'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'

const searchReply = {
  request_id: 'r1',
  total_results: 2,
  results: [
    { title: 'Nimble', url: 'https://nimbleway.com/', description: 'Web data' },
    { url: 'https://x.test/b', title: null },
  ],
}
const extractReply = {
  url: 'https://x.test/',
  status: 'success',
  data: { html: '<p>hi</p>', markdown: 'hi' },
  metadata: { driver: 'vx6' },
}

interface Req {
  url: string
  headers: Record<string, string>
  body: object
}

// A Post that replays one recorded reply through the real schema decode.
const recorded = (reply: unknown) => {
  const seen: Req[] = []
  const post: Post = (url, headers, body, schema) => {
    seen.push({ url, headers, body })
    return Schema.decodeUnknownEffect(schema)(reply).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  return { post, seen }
}

const run = (reply: unknown, job: 'search' | 'scrape', input: TaskInput) => {
  const { post, seen } = recorded(reply)
  const call = nimble(post, 'k')[job]
  return (call ? call(input) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts the query with Bearer and maps title, url, description', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search', { query: 'q' })
      expect(req?.url).toBe('https://sdk.nimbleway.com/v2/search')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({
        query: 'q',
        focus: 'general',
        max_results: 5,
        search_depth: 'standard',
      })
      expect(o.urls).toEqual(['https://nimbleway.com/', 'https://x.test/b'])
      expect(o.text).toBe('Nimble\nhttps://nimbleway.com/\nWeb data\n\n\nhttps://x.test/b\n')
      expect(o.costUsd).toBe(0.005)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('scrape posts extract with markdown format and returns the markdown', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(extractReply, 'scrape', { url: 'https://x.test/' })
      expect(req?.url).toBe('https://sdk.nimbleway.com/v2/extract')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({ url: 'https://x.test/', formats: ['markdown'] })
      expect(o.text).toBe('hi')
      expect(o.urls).toEqual(['https://x.test/'])
      expect(o.costUsd).toBe(0.001)
    }),
  ))

test('a reply missing results fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }, 'search', { query: 'q' }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
