// Contract for the Browserbase peer adapter: request shape per endpoint and
// how recorded replies (shaped like docs.browserbase.com examples) map to Output.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { HttpClient } from 'effect/http'
import { browserbase } from '../../scripts/bench/peers/browserbase.ts'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { recorded } from './replay.ts'

const searchReply = {
  requestId: 'req_1',
  results: [
    { id: 'r1', url: 'https://browserbase.com', title: 'Browserbase' },
    { id: 'r2', url: 'https://x.test/b', title: null },
  ],
}
const fetchReply = {
  id: 'f1',
  statusCode: 200,
  headers: {},
  content: '# Page\ntext',
  contentType: 'text/markdown',
  encoding: 'utf-8',
}

const unused = HttpClient.make(() => Effect.die('no GET expected'))

const run = (reply: unknown, job: 'search' | 'scrape', input: TaskInput) => {
  const { post, seen } = recorded(reply)
  const call = browserbase(post, 'k', unused)[job]
  return (call ? call(input) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts query with x-bb-api-key and maps title and url', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search', { query: 'q' })
      expect(req?.url).toBe('https://api.browserbase.com/v1/search')
      expect(req?.headers).toEqual({ 'x-bb-api-key': 'k' })
      expect(req?.body).toEqual({ query: 'q', numResults: 5 })
      expect(o.urls).toEqual(['https://browserbase.com', 'https://x.test/b'])
      expect(o.text).toBe('Browserbase\nhttps://browserbase.com\n\n\nhttps://x.test/b')
      expect(o.costUsd).toBe(0.001)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('scrape posts Fetch in markdown and maps content', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(fetchReply, 'scrape', { url: 'https://p.test' })
      expect(req?.url).toBe('https://api.browserbase.com/v1/fetch')
      expect(req?.body).toEqual({ url: 'https://p.test', format: 'markdown' })
      expect(o.text).toBe('# Page\ntext')
      expect(o.urls).toEqual(['https://p.test'])
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
