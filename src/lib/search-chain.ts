// Search with a fallback chain: the default web source tries each keyless
// source in SEARCH_SOURCES order, one at a time, until one returns hits.
// Also home of the scholarly backends: Crossref and OpenAlex (keyless REST
// APIs; WEBULAR_MAILTO joins their polite pool).
import { Config, Data, Effect, Schema } from 'effect'
import { fetchText } from '../core/http.ts'
import { webSearch } from './search.ts'
import {
  endpoint,
  plain,
  SEARCH_SOURCES,
  type SearchSource,
  sourceSearch,
} from './sources-search.ts'

interface Hit {
  title: string
  url: string
  description: string
}

interface Answer {
  source?: SearchSource
  results: Hit[]
}

class SearchSourceError extends Data.TaggedError('SearchSourceError')<{
  source: SearchSource
  cause: unknown
}> {}

class EmptySearchError extends Data.TaggedError('EmptySearchError')<{
  source: SearchSource
}> {}

const Crossref = Schema.fromJsonString(
  Schema.Struct({
    message: Schema.Struct({
      items: Schema.Array(
        Schema.Struct({
          URL: Schema.String,
          title: Schema.optional(Schema.Array(Schema.String)),
          abstract: Schema.optional(Schema.String),
        }),
      ),
    }),
  }),
)

const OpenAlex = Schema.fromJsonString(
  Schema.Struct({
    results: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        doi: Schema.NullOr(Schema.String),
        display_name: Schema.NullOr(Schema.String),
        abstract_inverted_index: Schema.optional(
          Schema.NullOr(Schema.Record(Schema.String, Schema.Array(Schema.Number))),
        ),
      }),
    ),
  }),
)

// OpenAlex ships abstracts as word -> positions; put each word back in place.
function unInvert(index: Readonly<Record<string, ReadonlyArray<number>>>): string {
  const words: string[] = []
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word
  return words.filter(Boolean).join(' ')
}

// Fetch base + params (+ mailto when set) and decode the JSON body.
const getJson = Effect.fn('scholarlyGet')(function* <A>(
  schema: Schema.Codec<A, string>,
  base: string,
  params: Record<string, string>,
) {
  const mailto = yield* Config.String('WEBULAR_MAILTO').pipe(Config.withDefault(''))
  const url = endpoint(base, mailto ? { ...params, mailto } : params)
  const body = yield* fetchText(url, { timeoutMs: 20_000 })
  return yield* Schema.decodeUnknownEffect(schema)(body)
})

const crossref = (query: string, limit: number) =>
  getJson(Crossref, 'https://api.crossref.org/works', { query, rows: String(limit) }).pipe(
    Effect.map(({ message }) =>
      message.items.map((w) => ({
        title: w.title?.[0] ?? '',
        url: w.URL,
        description: plain(w.abstract ?? ''),
      })),
    ),
  )

const openalex = (query: string, limit: number) =>
  getJson(OpenAlex, 'https://api.openalex.org/works', {
    search: query,
    'per-page': String(limit),
  }).pipe(
    Effect.map(({ results }) =>
      results.map((w) => ({
        title: w.display_name ?? '',
        url: w.doi ?? w.id,
        description: w.abstract_inverted_index ? unInvert(w.abstract_inverted_index) : '',
      })),
    ),
  )

const one = (source: SearchSource, query: string, limit: number) => {
  if (source === 'crossref') return crossref(query, limit)
  if (source === 'openalex') return openalex(query, limit)
  return source === 'web' ? webSearch(query, limit) : sourceSearch(source, query, limit)
}

const searchSourceEffect = (source: SearchSource, query: string, limit: number) =>
  one(source, query, limit).pipe(
    Effect.map((hits) => hits.slice(0, limit)),
    Effect.mapError((cause) => new SearchSourceError({ source, cause })),
  )

// Sequential by construction: firstSuccessOf runs the next source only after
// the previous one failed. An empty answer counts as a failure.
const fallbackSearchEffect = (query: string, limit: number) =>
  Effect.firstSuccessOf(
    SEARCH_SOURCES.map((source) =>
      searchSourceEffect(source, query, limit).pipe(
        Effect.filterOrFail(
          (results) => results.length > 0,
          () => new EmptySearchError({ source }),
        ),
        Effect.map((results): Answer => ({ source, results })),
      ),
    ),
  )

// The default web source runs the chain; an explicit source queries just that
// source.
export const searchWithSource = (source: SearchSource, query: string, limit: number) =>
  source === 'web'
    ? fallbackSearchEffect(query, limit)
    : Effect.map(searchSourceEffect(source, query, limit), (results): Answer => ({ results }))
