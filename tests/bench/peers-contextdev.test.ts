// Contract for the Context.dev peer adapter: request shape per endpoint and how
// recorded replies (trimmed from docs.context.dev schemas) map to Output.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { contextdev } from '../../scripts/bench/peers/contextdev.ts'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { recorded } from './replay.ts'

const searchReply = {
  partial: false,
  query: 'q',
  request_id: 'r1',
  results: [
    { url: 'https://context.dev/', title: 'Context', description: 'Web API', relevance: 'high' },
    { url: 'https://x.test/b', title: null },
  ],
}
const scrapeReply = {
  url: 'https://x.test/',
  markdown: { requested: true, success: true, data: '# Example' },
  metadata: { title: 'Example' },
}

const run = (reply: unknown, job: 'search' | 'scrape', input: TaskInput) => {
  const { post, seen } = recorded(reply)
  const call = contextdev(post, 'k')[job]
  return (call ? call(input) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts numResults with Bearer and maps title, url, description', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search', { query: 'q' })
      expect(req?.url).toBe('https://api.context.dev/v1/web/search')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({ query: 'q', numResults: 5 })
      expect(o.urls).toEqual(['https://context.dev/', 'https://x.test/b'])
      expect(o.text).toBe('Context\nhttps://context.dev/\nWeb API\n\n\nhttps://x.test/b\n')
      expect(o.costUsd).toBe(0.0022)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('scrape posts markdown format and returns markdown.data', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(scrapeReply, 'scrape', { url: 'https://x.test/' })
      expect(req?.url).toBe('https://api.context.dev/v1/web/scrape')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({ url: 'https://x.test/', formats: { markdown: true } })
      expect(o.text).toBe('# Example')
      expect(o.urls).toEqual(['https://x.test/'])
    }),
  ))

test('a reply missing markdown fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }, 'scrape', { url: 'https://x.test/' }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
