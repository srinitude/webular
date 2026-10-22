// Keyless REST search backends: Crossref, OpenAlex, and the npm registry
// (WEBULAR_MAILTO joins their polite pool).
import { Config, Effect, Schema } from 'effect'
import { fetchText } from '../core/http.ts'
import { HttpStatusError } from '../core/http-body.ts'
import { logErr } from '../core/output.ts'
import { rateLimit, sourceUrl, unlessLimited } from './sources/polite.ts'
import { plain, SOURCE_TIMEOUT_MS } from './sources-search.ts'

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
  onResponse: (res: Response) => void = () => {},
) {
  const mailto = yield* Config.String('WEBULAR_MAILTO').pipe(Config.withDefault(''))
  const url = yield* sourceUrl(base, mailto ? { ...params, mailto } : params)
  const body = yield* fetchText(url, { timeoutMs: SOURCE_TIMEOUT_MS, onResponse })
  return yield* Schema.decodeUnknownEffect(schema)(body)
})

export const crossref = (query: string, limit: number) =>
  getJson(Crossref, 'https://api.crossref.org/works', { query, rows: String(limit) }).pipe(
    Effect.map(({ message }) =>
      message.items.map((w) => ({
        title: w.title?.[0] ?? '',
        url: w.URL,
        description: plain(w.abstract ?? ''),
      })),
    ),
  )

const OPENALEX = 'https://api.openalex.org/works'

// Epoch ms before which OpenAlex is skipped: a 429 blocks it for its
// retry-after, else a minute, so a spent pool costs no request.
export const OpenAlexLimit = rateLimit('OpenAlex')

// A spent pool (429) is no hits, not a failure; WEBULAR_TRACE=1 says so on stderr.
const spentPool = (err: unknown) => err instanceof HttpStatusError && err.status === 429
const noHits = () =>
  Effect.gen(function* () {
    const trace = yield* Config.String('WEBULAR_TRACE').pipe(Config.withDefault(''))
    if (trace === '1') yield* logErr('openalex: 429, skipped')
    return []
  }).pipe(Effect.orElseSucceed(() => []))

export const openalex = (query: string, limit: number) =>
  unlessLimited(OpenAlexLimit, OPENALEX, (onResponse) =>
    getJson(OpenAlex, OPENALEX, { search: query, 'per-page': String(limit) }, onResponse),
  ).pipe(
    Effect.map(({ results }) =>
      results.map((w) => ({
        title: w.display_name ?? '',
        url: w.doi ?? w.id,
        description: w.abstract_inverted_index ? unInvert(w.abstract_inverted_index) : '',
      })),
    ),
    Effect.catchIf(spentPool, noHits),
  )

const Npm = Schema.fromJsonString(
  Schema.Struct({
    objects: Schema.Array(
      Schema.Struct({
        package: Schema.Struct({
          name: Schema.String,
          description: Schema.optional(Schema.String),
          links: Schema.Struct({ npm: Schema.String, homepage: Schema.optional(Schema.String) }),
        }),
      }),
    ),
  }),
)

// Navigational filler: npm's text search ranks worse with it.
const NAV_FILLER =
  /\b(official|site|website|homepage|home page|docs?|documentation|library|github)\b/gi

// npm registry search (keyless): a package's homepage is its official site.
// Only packages whose name (scope dropped) is a query word count, so a
// navigational query finds its project and nothing near it.
// The name filter drops most of a page, so ask for a full page whatever the limit.
const NPM_PAGE = 20
// npm only adds homepages, so it gets a shorter leash than the other sources.
const NPM_TIMEOUT_MS = 1_500
export const npm = (query: string, limit: number) =>
  getJson(Npm, 'https://registry.npmjs.org/-/v1/search', {
    text: query.replace(NAV_FILLER, ' ').replace(/\s+/g, ' ').trim(),
    size: String(NPM_PAGE),
  }).pipe(
    Effect.timeout(NPM_TIMEOUT_MS),
    Effect.map(({ objects }) => {
      const words = new Set(query.toLowerCase().split(/[^a-z0-9-]+/))
      return objects
        .filter((o) => words.has(o.package.name.split('/').at(-1) ?? ''))
        .map(({ package: p }) => ({
          title: p.name,
          url: p.links.homepage ?? p.links.npm,
          description: p.description ?? '',
        }))
        .slice(0, limit)
    }),
  )
