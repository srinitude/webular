// Contract for the TinyFish peer adapter: GET search through a replaying
// HttpClient, POST fetch through a replaying Post, and how recorded replies
// (trimmed from docs.tinyfish.ai examples) map to Output.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'
import { tinyfish } from '../../scripts/bench/peers/tinyfish.ts'

const searchReply = {
  query: 'q',
  results: [
    {
      position: 1,
      site_name: 'tinyfish.ai',
      title: 'TinyFish',
      snippet: 'web',
      url: 'https://tinyfish.ai',
    },
    { position: 2, url: 'https://x.test/b' },
  ],
  total_results: 2,
  page: 0,
}
const fetchReply = {
  results: [
    { url: 'https://p.test', final_url: 'https://p.test', format: 'markdown', text: '# P' },
  ],
  errors: [],
}

interface Req {
  url: string
  headers: Record<string, string>
  body?: object
}

const run = (reply: unknown, job: 'search' | 'scrape', input: TaskInput) => {
  const seen: Req[] = []
  const post: Post = (url, headers, body, schema) => {
    seen.push({ url, headers, body })
    return Schema.decodeUnknownEffect(schema)(reply).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  const client = HttpClient.make((req, url) => {
    seen.push({ url: url.toString(), headers: { ...req.headers } })
    return Effect.succeed(HttpClientResponse.fromWeb(req, new Response(JSON.stringify(reply))))
  })
  const call = tinyfish(post, 'k', client)[job]
  return (call ? call(input) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search GETs the query with X-API-Key and maps title, url, snippet', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search', { query: 'a b' })
      expect(req?.url).toBe('https://api.search.tinyfish.ai/?query=a+b')
      expect(req?.headers['x-api-key']).toBe('k')
      expect(o.urls).toEqual(['https://tinyfish.ai', 'https://x.test/b'])
      expect(o.text).toBe('TinyFish\nhttps://tinyfish.ai\nweb\n\n\nhttps://x.test/b\n')
      expect(o.costUsd).toBe(0)
    }),
  ))

test('scrape posts Fetch in markdown and maps text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(fetchReply, 'scrape', { url: 'https://p.test' })
      expect(req?.url).toBe('https://api.fetch.tinyfish.ai')
      expect(req?.headers).toEqual({ 'x-api-key': 'k' })
      expect(req?.body).toEqual({ urls: ['https://p.test'], format: 'markdown' })
      expect(o.text).toBe('# P')
      expect(o.costUsd).toBe(0)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a bad reply fails as a BenchError on both jobs, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const s = yield* Effect.flip(run({ nope: 1 }, 'search', { query: 'q' }))
      const f = yield* Effect.flip(run({ nope: 1 }, 'scrape', { url: 'u' }))
      expect([s._tag, f._tag]).toEqual(['BenchError', 'BenchError'])
    }),
  ))
