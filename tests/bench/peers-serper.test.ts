// Contract for the Serper peer adapter: request shape and how a recorded
// reply (trimmed from the serper.dev playground) maps to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'
import { serper } from '../../scripts/bench/peers/serper.ts'

interface Req {
  url: string
  headers: Record<string, string>
  body: object
}

const unused = HttpClient.make((req) =>
  Effect.succeed(HttpClientResponse.fromWeb(req, new Response('{}'))),
)

const run = (reply: unknown) => {
  const seen: Req[] = []
  const post: Post = (url, headers, body, schema) => {
    seen.push({ url, headers, body })
    return Schema.decodeUnknownEffect(schema)(reply).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  const call = serper(post, 'k', unused).search
  return (call ? call({ query: 'q' }) : Effect.die('no search')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts q with X-API-KEY and maps organic hits', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const reply = {
        organic: [
          { title: 'A', link: 'https://a.test', snippet: 's', position: 1 },
          { link: 'https://b.test' },
        ],
      }
      const { o, req } = yield* run(reply)
      expect(req?.url).toBe('https://google.serper.dev/search')
      expect(req?.headers).toEqual({ 'x-api-key': 'k' })
      expect(req?.body).toEqual({ q: 'q', num: 5 })
      expect(o.text).toBe('A\nhttps://a.test\ns\n\n\nhttps://b.test\n')
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.costUsd).toBe(0.001)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a reply missing organic fails as a BenchError', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
