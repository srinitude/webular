// Contract for the ScrapeGraphAI peer adapter: request shape and how a
// recorded reply (trimmed from docs.scrapegraphai.com) maps to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'
import { scrapegraph } from '../../scripts/bench/peers/scrapegraph.ts'

const reply = {
  request_id: 'r1',
  status: 'completed',
  website_url: 'https://scrapegraphai.com/',
  user_prompt: 'p',
  result: { company: 'ScrapeGraphAI', services: ['scraping'] },
  error: '',
}

const run = (body: unknown) => {
  const seen: { url: string; headers: Record<string, string>; body: object }[] = []
  const post: Post = (url, headers, b, schema) => {
    seen.push({ url, headers, body: b })
    return Schema.decodeUnknownEffect(schema)(body).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  const call = scrapegraph(post, 'k', {} as HttpClient.HttpClient).scrape
  return (call ? call({ url: 'https://x.test/a' }) : Effect.die('no scrape job')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('scrape posts SmartScraper with SGAI-APIKEY and maps the result', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(reply)
      expect(req?.url).toBe('https://api.scrapegraphai.com/v1/smartscraper')
      expect(req?.headers).toEqual({ 'SGAI-APIKEY': 'k' })
      expect(req?.body).toMatchObject({ website_url: 'https://x.test/a' })
      expect(o.text).toBe('{"company":"ScrapeGraphAI","services":["scraping"]}')
      expect(o.urls).toEqual(['https://x.test/a'])
      expect(o.costUsd).toBeCloseTo(0.02)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a string result passes through as text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o } = yield* run({ result: 'plain' })
      expect(o.text).toBe('plain')
    }),
  ))

test('a reply missing result fails as a BenchError', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
