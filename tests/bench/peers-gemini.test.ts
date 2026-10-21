// Contract for the Gemini grounding peer adapter: request shape and how a
// recorded reply (trimmed from ai.google.dev google-search docs) maps to Output.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { gemini } from '../../scripts/bench/peers/gemini.ts'
import { recorded } from './replay.ts'

const unused = HttpClient.make((req) =>
  Effect.succeed(HttpClientResponse.fromWeb(req, new Response('{}'))),
)

const run = (reply: unknown) => {
  const { post, seen } = recorded(reply)
  const call = gemini(post, 'k', unused).answer
  return (call ? call({ query: 'q' }) : Effect.die('no answer')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

const reply = {
  candidates: [
    {
      content: { parts: [{ text: 'Spain won ' }, { text: 'Euro 2024.' }], role: 'model' },
      groundingMetadata: {
        webSearchQueries: ['euro 2024 winner'],
        groundingChunks: [
          { web: { uri: 'https://a.test', title: 'a' } },
          { web: { uri: 'https://b.test', title: 'b' } },
        ],
        groundingSupports: [
          {
            segment: { startIndex: 0, endIndex: 20, text: 'Spain won Euro 2024.' },
            groundingChunkIndices: [0, 1],
          },
        ],
      },
    },
  ],
  usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 1000 },
}

test('answer posts google_search grounding with x-goog-api-key and maps supports to citations', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { o, req } = yield* run(reply)
      expect(req?.url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      )
      expect(req?.headers).toEqual({ 'x-goog-api-key': 'k' })
      expect(req?.body).toEqual({
        contents: [{ parts: [{ text: 'q' }] }],
        tools: [{ google_search: {} }],
      })
      expect(o.text).toBe('Spain won Euro 2024.')
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.citations).toEqual([
        { url: 'https://a.test', text: 'Spain won Euro 2024.' },
        { url: 'https://b.test', text: 'Spain won Euro 2024.' },
      ])
      expect(o.costUsd).toBeCloseTo(0.035 + 0.0028, 10)
      expect(o.sentBytes).toBe(7)
    }),
  ))

test('a reply missing candidates fails as a BenchError', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const e = yield* Effect.flip(run({ nope: 1 }))
      expect(e._tag).toBe('BenchError')
    }),
  ))
