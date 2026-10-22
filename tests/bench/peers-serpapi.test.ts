// Contract for the SerpApi peer adapter: the GET request it sends and how a
// recorded reply (trimmed from serpapi.com/search-api) maps to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'
import { serpapi } from '../../scripts/bench/peers/serpapi.ts'

const noPost: Post = (_u, _h, _b, schema) =>
  Schema.decodeUnknownEffect(schema)(null).pipe(
    Effect.mapError(fail),
    Effect.map((r) => ({ r, sentBytes: 0 })),
  )

// An HttpClient that replays one recorded reply and keeps the request URL.
const run = (reply: unknown, status = 200) => {
  const seen: URL[] = []
  const client = HttpClient.make((req, url) => {
    seen.push(url)
    return Effect.succeed(
      HttpClientResponse.fromWeb(req, new Response(JSON.stringify(reply), { status })),
    )
  })
  const call = serpapi(noPost, 'k', client).search
  return (call ? call({ query: 'q' }) : Effect.die('no search')).pipe(
    Effect.map((o) => ({ o, url: seen[0] })),
  )
}

test('search GETs search.json with the key as api_key and maps organic_results', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const reply = {
        organic_results: [
          { position: 1, title: 'A', link: 'https://a.test', snippet: 's' },
          { link: 'https://b.test' },
        ],
      }
      const { o, url } = yield* run(reply)
      expect(url?.origin + (url?.pathname ?? '')).toBe('https://serpapi.com/search.json')
      expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
        engine: 'google',
        q: 'q',
        num: '5',
        api_key: 'k',
      })
      expect(o.text).toBe('A\nhttps://a.test\ns\n\n\nhttps://b.test\n')
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.costUsd).toBe(0.025)
      expect(o.sentBytes).toBe('engine=google&q=q&num=5'.length)
    }),
  ))

test('a bad reply or a non-2xx status fails as a BenchError', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      expect((yield* Effect.flip(run({ nope: 1 })))._tag).toBe('BenchError')
      expect((yield* Effect.flip(run({ organic_results: [] }, 401)))._tag).toBe('BenchError')
    }),
  ))
