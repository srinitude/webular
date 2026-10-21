// Contract for the Jina peer adapter: request shape per endpoint, keyless
// Reader calls, and how recorded replies (shaped like the jina-ai/reader JSON
// mode examples) map to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { HttpClient } from 'effect/http'
import { jina } from '../../scripts/bench/peers/jina.ts'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'

const readReply = {
  code: 200,
  status: 20000,
  data: { title: 'Ex', url: 'https://ex.test/', content: '# Ex\nbody', usage: { tokens: 200 } },
}
const searchReply = {
  code: 200,
  data: [
    { title: 'A', url: 'https://a.test', description: 'first', content: 'x' },
    { url: 'https://b.test' },
  ],
}

interface Req {
  url: string
  headers: Record<string, string>
  body: object
}

const unused = HttpClient.make(() => Effect.die('no GET expected'))

// A Post that replays one recorded reply through the real schema decode.
const run = (reply: unknown, job: 'search' | 'scrape', input: TaskInput, key = 'k') => {
  const seen: Req[] = []
  const post: Post = (url, headers, body, schema) => {
    seen.push({ url, headers, body })
    return Schema.decodeUnknownEffect(schema)(reply).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  const call = jina(post, key, unused)[job]
  return (call ? call(input) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('scrape posts the url to Reader with Bearer, JSON, no-cache and maps content', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(readReply, 'scrape', { url: 'https://ex.test/' })
      expect(req?.url).toBe('https://r.jina.ai/')
      expect(req?.headers).toEqual({
        accept: 'application/json',
        'x-no-cache': 'true',
        authorization: 'Bearer k',
      })
      expect(req?.body).toEqual({ url: 'https://ex.test/' })
      expect(o.text).toBe('# Ex\nbody')
      expect(o.urls).toEqual(['https://ex.test/'])
      expect(o.costUsd).toBeCloseTo(200 * 0.05e-6, 12)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('an empty key sends no Authorization header', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { req } = yield* run(readReply, 'scrape', { url: 'https://ex.test/' }, '')
      expect(req?.headers).toEqual({ accept: 'application/json', 'x-no-cache': 'true' })
    }),
  ))

test('search posts q to s.jina.ai and maps title, url, description', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search', { query: 'q' })
      expect(req?.url).toBe('https://s.jina.ai/')
      expect(req?.body).toEqual({ q: 'q', num: 5 })
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.text).toBe('A\nhttps://a.test\nfirst\n\n\nhttps://b.test\n')
      expect(o.costUsd).toBeCloseTo(10_000 * 0.05e-6, 12)
    }),
  ))

test('a reply missing data fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }, 'scrape', { url: 'u' }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
