// Peer adapters over each HTTP API, built on the shared Effect HttpClient.
// Prices are each peer's published list price (see PRICING_SOURCES); a
// response that reports its own cost (Exa costDollars) wins over the list.
import { Effect, Schema } from 'effect'
import { type HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import { BenchError, type Output, type Provider } from './model.ts'

export const PRICING_SOURCES: Record<string, string> = {
  firecrawl:
    'https://www.firecrawl.dev/pricing (Standard $83 / 100,000 credits; scrape 1 credit, search 2 per 10 results)',
  exa: 'https://exa.ai/pricing (search $5 / 1k, contents $1 / 1k pages, answer $5 / 1k)',
  tavily: 'https://www.tavily.com/pricing (pay as you go $0.008 / credit; basic search 1 credit)',
  perplexity: 'https://docs.perplexity.ai/guides/pricing (sonar $5 / 1k requests + $1 / M tokens)',
  parallel:
    'https://docs.parallel.ai/getting-started/pricing (search fast $1 / 1k, responses low $10 / 1k)',
}
const FIRECRAWL_CREDIT_USD = 83 / 100_000

export const fail = (e: unknown) =>
  new BenchError({ message: e instanceof Error ? e.message : String(e) })
export const bytes = (s: string) => new TextEncoder().encode(s).length
type Jobs = Provider['jobs']
export type Post = <A>(
  url: string,
  headers: Record<string, string>,
  body: object,
  schema: Schema.Codec<A>,
) => Effect.Effect<{ r: A; sentBytes: number }, BenchError>

export const poster =
  (client: HttpClient.HttpClient): Post =>
  (url, headers, body, schema) =>
    HttpClientRequest.post(url).pipe(
      HttpClientRequest.setHeaders(headers),
      HttpClientRequest.bodyJson(body),
      Effect.flatMap((req) => client.execute(req)),
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.json),
      Effect.flatMap(Schema.decodeUnknownEffect(schema)),
      Effect.timeout('90 seconds'),
      Effect.map((r) => ({ r, sentBytes: bytes(JSON.stringify(body)) })),
      Effect.mapError(fail),
    )

export const out = (text: string, urls: string[], costUsd: number, sentBytes: number): Output => ({
  text,
  urls,
  citations: [],
  costUsd,
  sentBytes,
})

const FcScrape = Schema.Struct({ data: Schema.Struct({ markdown: Schema.String }) })
const FcHit = Schema.Struct({
  url: Schema.String,
  title: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
})
const FcSearch = Schema.Struct({ data: Schema.Struct({ web: Schema.Array(FcHit) }) })

export const firecrawl = (post: Post, key: string): Jobs => {
  const auth = { authorization: `Bearer ${key}` }
  const api = 'https://api.firecrawl.dev/v2'
  return {
    scrape: ({ url = '' }) =>
      post(`${api}/scrape`, auth, { url, formats: ['markdown'] }, FcScrape).pipe(
        Effect.map(({ r, sentBytes }) =>
          out(r.data.markdown, [url], FIRECRAWL_CREDIT_USD, sentBytes),
        ),
      ),
    search: ({ query = '' }) =>
      post(`${api}/search`, auth, { query, limit: 5 }, FcSearch).pipe(
        Effect.map(({ r, sentBytes }) => {
          const hits = r.data.web
          const text = hits.map((h) => `${h.title ?? ''}\n${h.url}\n${h.description ?? ''}`)
          const urls = hits.map((h) => h.url)
          return out(text.join('\n\n'), urls, 2 * FIRECRAWL_CREDIT_USD, sentBytes)
        }),
      ),
  }
}

const ExaCost = Schema.optionalKey(Schema.Struct({ total: Schema.Number }))
const ExaDoc = Schema.Struct({
  url: Schema.String,
  title: Schema.optionalKey(Schema.NullOr(Schema.String)),
  text: Schema.optionalKey(Schema.String),
})
const ExaList = Schema.Struct({ results: Schema.Array(ExaDoc), costDollars: ExaCost })
const ExaAnswer = Schema.Struct({
  answer: Schema.String,
  citations: Schema.Array(ExaDoc),
  costDollars: ExaCost,
})

const exaAnswerOut = (r: typeof ExaAnswer.Type, sentBytes: number): Output => ({
  ...out(
    r.answer,
    r.citations.map((c) => c.url),
    r.costDollars?.total ?? 0.005,
    sentBytes,
  ),
  citations: r.citations.map((c) => ({ url: c.url, text: c.text ?? '' })),
})

export const exa = (post: Post, key: string): Jobs => {
  const auth = { 'x-api-key': key }
  const api = 'https://api.exa.ai'
  return {
    search: ({ query = '' }) =>
      post(`${api}/search`, auth, { query, numResults: 5 }, ExaList).pipe(
        Effect.map(({ r, sentBytes }) => {
          const text = r.results.map((h) => `${h.title ?? ''}\n${h.url}`).join('\n\n')
          return out(
            text,
            r.results.map((h) => h.url),
            r.costDollars?.total ?? 0.005,
            sentBytes,
          )
        }),
      ),
    scrape: ({ url = '' }) =>
      post(`${api}/contents`, auth, { urls: [url], text: true }, ExaList).pipe(
        Effect.map(({ r, sentBytes }) => {
          const text = r.results.map((h) => h.text ?? '').join('\n\n')
          return out(text, [url], r.costDollars?.total ?? 0.001, sentBytes)
        }),
      ),
    answer: ({ query = '' }) =>
      post(`${api}/answer`, auth, { query, text: true }, ExaAnswer).pipe(
        Effect.map(({ r, sentBytes }) => exaAnswerOut(r, sentBytes)),
      ),
  }
}

const TavilyOut = Schema.Struct({
  answer: Schema.optionalKey(Schema.NullOr(Schema.String)),
  results: Schema.Array(Schema.Struct({ url: Schema.String, content: Schema.String })),
})

export const tavily = (post: Post, key: string): Jobs => {
  const auth = { authorization: `Bearer ${key}` }
  const run = (query: string, answer: boolean) =>
    post(
      'https://api.tavily.com/search',
      auth,
      { query, max_results: 5, include_answer: answer },
      TavilyOut,
    ).pipe(
      Effect.map(({ r, sentBytes }) => {
        const urls = r.results.map((h) => h.url)
        if (!answer) {
          const text = r.results.map((h) => `${h.url}\n${h.content}`).join('\n\n')
          return out(text, urls, 0.008, sentBytes)
        }
        const citations = r.results.map((h) => ({ url: h.url, text: h.content }))
        return { ...out(r.answer ?? '', urls, 0.008, sentBytes), citations }
      }),
    )
  return {
    search: ({ query = '' }) => run(query, false),
    answer: ({ query = '' }) => run(query, true),
  }
}

const PplxOut = Schema.Struct({
  choices: Schema.Array(Schema.Struct({ message: Schema.Struct({ content: Schema.String }) })),
  citations: Schema.optionalKey(Schema.Array(Schema.String)),
  usage: Schema.optionalKey(Schema.Struct({ total_tokens: Schema.Number })),
})

export const perplexity = (post: Post, key: string): Jobs => ({
  answer: ({ query = '' }) => {
    const body = { model: 'sonar', messages: [{ role: 'user', content: query }] }
    const auth = { authorization: `Bearer ${key}` }
    return post('https://api.perplexity.ai/chat/completions', auth, body, PplxOut).pipe(
      Effect.map(({ r, sentBytes }) => {
        const urls = [...(r.citations ?? [])]
        const cost = 0.005 + (r.usage?.total_tokens ?? 0) / 1e6
        return {
          ...out(r.choices[0]?.message.content ?? '', urls, cost, sentBytes),
          citations: urls.map((url) => ({ url, text: '' })),
        }
      }),
    )
  },
})
