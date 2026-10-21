// Contract for the Parallel peer adapter: request shape per endpoint and how
// recorded replies (trimmed from docs.parallel.ai examples) map to Output.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { parallel } from '../../scripts/bench/peers/parallel.ts'
import { recorded } from './replay.ts'

const searchReply = {
  search_id: 'search_1',
  results: [
    {
      url: 'https://parallel.ai/',
      title: 'Parallel',
      publish_date: null,
      excerpts: ['Web APIs', 'for AIs'],
    },
    { url: 'https://x.test/b', title: null },
  ],
  warnings: null,
  usage: [{ name: 'sku_search', count: 1 }],
}
const cite = (url: string, start: number) => ({
  type: 'url_citation',
  url,
  title: 'T',
  start_index: start,
  end_index: start + 9,
})
const answerReply = {
  output: [
    { type: 'web_search_call', id: 'ws_1' },
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: 'Jensen Huang has led Nvidia since 1993.',
          annotations: [
            cite('https://a.test', 0),
            cite('https://b.test', 0),
            cite('https://a.test', 11),
          ],
        },
      ],
    },
  ],
}

const run = (reply: unknown, job: 'search' | 'answer', input: TaskInput) => {
  const { post, seen } = recorded(reply)
  const call = parallel(post, 'k')[job]
  return (call ? call(input) : Effect.die(`no ${job} job`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search posts fast mode with x-api-key and maps title, url, excerpts', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(searchReply, 'search', { query: 'q' })
      expect(req?.url).toBe('https://api.parallel.ai/v1/search')
      expect(req?.headers).toEqual({ 'x-api-key': 'k' })
      expect(req?.body).toMatchObject({ objective: 'q', search_queries: ['q'], mode: 'fast' })
      expect(o.urls).toEqual(['https://parallel.ai/', 'https://x.test/b'])
      expect(o.text).toBe(
        'Parallel\nhttps://parallel.ai/\nWeb APIs\nfor AIs\n\n\nhttps://x.test/b\n',
      )
      expect(o.costUsd).toBe(0.001)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('answer posts the Responses API with Bearer and dedupes cited urls', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(answerReply, 'answer', { query: 'q' })
      expect(req?.url).toBe('https://api.parallel.ai/v1/responses')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({ model: 'parallel', input: 'q', reasoning: { effort: 'low' } })
      expect(o.text).toBe('Jensen Huang has led Nvidia since 1993.')
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.citations).toEqual([
        { url: 'https://a.test', text: '' },
        { url: 'https://b.test', text: '' },
      ])
      expect(o.costUsd).toBe(0.01)
    }),
  ))

test('a reply missing results fails as a BenchError, never a fake output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }, 'search', { query: 'q' }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
