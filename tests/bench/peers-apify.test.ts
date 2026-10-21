// Contract for the Apify peer adapter: request shape and how recorded
// website-content-crawler dataset items map to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import { apify } from '../../scripts/bench/peers/apify.ts'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'

const items = [
  { url: 'https://x.test/a', text: 'Hello page', markdown: '# Hello', metadata: { title: 'A' } },
]

const run = (body: unknown) => {
  const seen: { url: string; headers: Record<string, string>; body: object }[] = []
  const post: Post = (url, headers, b, schema) => {
    seen.push({ url, headers, body: b })
    return Schema.decodeUnknownEffect(schema)(body).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  const call = apify(post, 'k', {} as HttpClient.HttpClient).scrape
  return (call ? call({ url: 'https://x.test/a' }) : Effect.die('no scrape job')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('scrape runs the crawler synchronously with a Bearer token and one page', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(items)
      expect(req?.url).toBe(
        'https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items',
      )
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toMatchObject({
        startUrls: [{ url: 'https://x.test/a' }],
        maxCrawlPages: 1,
        maxCrawlDepth: 0,
      })
      expect(o.text).toBe('Hello page')
      expect(o.urls).toEqual(['https://x.test/a'])
      expect(o.costUsd).toBeCloseTo(0.01)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a reply that is not an item list fails as a BenchError', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ error: { type: 'x' } }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
