// Contract for the Bright Data peer adapter: one /request endpoint routed by
// zone, SERP API for search and Web Unlocker for scrape, with recorded replies.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { brightdata } from '../../scripts/bench/peers/brightdata.ts'
import type { TaskInput } from '../../scripts/bench/peers/model.ts'
import { recorded } from './replay.ts'

const unused = HttpClient.make((req) =>
  Effect.succeed(HttpClientResponse.fromWeb(req, new Response('{}'))),
)

const run = (reply: unknown, job: 'search' | 'scrape', input: TaskInput) => {
  const { post, seen } = recorded(reply)
  const call = brightdata(post, 'k', unused)[job]
  return (call ? call(input) : Effect.die(`no ${job}`)).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('search sends a Google URL with brd_json=1 to the SERP zone and maps organic', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const reply = {
        general: {},
        organic: [{ link: 'https://a.test', title: 'A', description: 'd', rank: 1 }],
      }
      const { o, req } = yield* run(reply, 'search', { query: 'a b' })
      expect(req?.url).toBe('https://api.brightdata.com/request')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({
        zone: 'serp_api1',
        url: 'https://www.google.com/search?q=a%20b&num=5&brd_json=1',
        format: 'raw',
      })
      expect(o.text).toBe('A\nhttps://a.test\nd')
      expect(o.urls).toEqual(['https://a.test'])
      expect(o.costUsd).toBe(0.0015)
    }),
  ))

test('scrape sends the page to the Web Unlocker zone as markdown and maps the body', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run({ status_code: 200, headers: {}, body: '# Hi' }, 'scrape', {
        url: 'https://p.test',
      })
      expect(req?.body).toEqual({
        zone: 'web_unlocker1',
        url: 'https://p.test',
        format: 'json',
        data_format: 'markdown',
      })
      expect(o.text).toBe('# Hi')
      expect(o.urls).toEqual(['https://p.test'])
    }),
  ))

test('a bad reply fails as a BenchError', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }, 'search', { query: 'q' }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
