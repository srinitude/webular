// Gemini API adapter: answers with Grounding with Google Search, the
// `google_search` tool on generateContent (x-goog-api-key header).
// Docs: https://ai.google.dev/gemini-api/docs/google-search (v1beta API, read 2026-10-21).
// Model gemini-2.5-flash: the Flash model whose free tier includes grounding
// (500 grounded requests per day, shared with Flash-Lite; no card needed).
// Pricing: https://ai.google.dev/gemini-api/docs/pricing; costUsd is the paid
// list price, $35 / 1,000 grounded prompts plus $0.30 / M input and
// $2.50 / M output tokens, even when the call lands on the free tier.
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Output, Provider } from './model.ts'
import type { Post } from './peers.ts'

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GROUNDED_USD = 0.035

const Chunk = Schema.Struct({ web: Schema.optionalKey(Schema.Struct({ uri: Schema.String })) })
const Support = Schema.Struct({
  segment: Schema.Struct({ text: Schema.optionalKey(Schema.String) }),
  groundingChunkIndices: Schema.optionalKey(Schema.Array(Schema.Number)),
})
const Reply = Schema.Struct({
  candidates: Schema.Array(
    Schema.Struct({
      content: Schema.Struct({
        parts: Schema.Array(Schema.Struct({ text: Schema.optionalKey(Schema.String) })),
      }),
      groundingMetadata: Schema.optionalKey(
        Schema.Struct({
          groundingChunks: Schema.optionalKey(Schema.Array(Chunk)),
          groundingSupports: Schema.optionalKey(Schema.Array(Support)),
        }),
      ),
    }),
  ),
  usageMetadata: Schema.optionalKey(
    Schema.Struct({
      promptTokenCount: Schema.optionalKey(Schema.Number),
      candidatesTokenCount: Schema.optionalKey(Schema.Number),
    }),
  ),
})
type Reply = typeof Reply.Type

// Each grounding support cites the chunks it points at, with its own text.
const toOutput = (r: Reply, sentBytes: number): Output => {
  const c = r.candidates[0]
  const chunks = (c?.groundingMetadata?.groundingChunks ?? []).map((k) => k.web?.uri ?? '')
  const citations = (c?.groundingMetadata?.groundingSupports ?? []).flatMap((s) =>
    (s.groundingChunkIndices ?? []).map((i) => ({
      url: chunks[i] ?? '',
      text: s.segment.text ?? '',
    })),
  )
  const u = r.usageMetadata
  const tokensUsd = ((u?.promptTokenCount ?? 0) * 0.3 + (u?.candidatesTokenCount ?? 0) * 2.5) / 1e6
  return {
    text: (c?.content.parts ?? []).map((p) => p.text ?? '').join(''),
    urls: [...new Set(chunks.filter((x) => x !== ''))],
    citations: citations.filter((x) => x.url !== ''),
    costUsd: GROUNDED_USD + tokensUsd,
    sentBytes,
  }
}

export const gemini = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  answer: ({ query = '' }) =>
    post(
      ENDPOINT,
      { 'x-goog-api-key': key },
      { contents: [{ parts: [{ text: query }] }], tools: [{ google_search: {} }] },
      Reply,
    ).pipe(Effect.map(({ r, sentBytes }) => toOutput(r, sentBytes))),
})
