// Keyless general and entity search: Marginalia (independent small-web index,
// shared "public" key, about 15 queries a minute) and Wikidata entity search
// (CC0 data). Wikipedia lives in sources-search.ts.
import { Config, Effect, Option, Redacted, Schema } from 'effect'
import { getJson, type Hit, rateLimit, unlessLimited } from './polite.ts'

const Marginalia = Schema.fromJsonString(
  Schema.Struct({
    license: Schema.optional(Schema.String),
    results: Schema.Array(
      Schema.Struct({
        url: Schema.String,
        title: Schema.String,
        description: Schema.optional(Schema.String),
      }),
    ),
  }),
)

const Wikidata = Schema.fromJsonString(
  Schema.Struct({
    search: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        label: Schema.optional(Schema.String),
        description: Schema.optional(Schema.String),
        concepturi: Schema.optional(Schema.String),
      }),
    ),
  }),
)

// MARGINALIA_API_KEY, else the shared "public" key; kept Redacted until sent.
const marginaliaKey = Config.Redacted('MARGINALIA_API_KEY').pipe(
  Config.map(Redacted.value),
  Config.withDefault('public'),
)

// The data license (CC-BY-NC-SA) rides in each description as attribution.
export const marginalia = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  Effect.flatMap(marginaliaKey, (key) =>
    getJson(
      Marginalia,
      'https://api2.marginalia-search.com/search',
      { query, count: String(limit) },
      { headers: { 'API-Key': key } },
    ),
  ).pipe(
    Effect.map(({ license, results }) =>
      results.map((r) => ({
        title: r.title,
        url: r.url,
        description: [r.description, license && `Marginalia, ${license}`]
          .filter(Boolean)
          .join(' · '),
      })),
    ),
  )

export const wikidata = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Wikidata, 'https://www.wikidata.org/w/api.php', {
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    format: 'json',
    limit: String(limit),
  }).pipe(
    Effect.map(({ search }) =>
      search.map((e) => ({
        title: e.label ?? e.id,
        url: e.concepturi ?? `https://www.wikidata.org/wiki/${e.id}`,
        description: e.description ?? '',
      })),
    ),
  )

const GitHubRepos = Schema.fromJsonString(
  Schema.Struct({
    items: Schema.Array(
      Schema.Struct({
        full_name: Schema.String,
        html_url: Schema.String,
        description: Schema.NullOr(Schema.String),
        stargazers_count: Schema.Number,
      }),
    ),
  }),
)

const GITHUB_SEARCH = 'https://api.github.com/search/repositories'

// Process-wide: epoch ms before which GitHub search is skipped, set from its
// rate-limit headers (unlessLimited in polite.ts).
export const GitHubLimit = rateLimit('GitHub')

// GITHUB_TOKEN, then GH_TOKEN, as a bearer header; kept Redacted until sent.
const githubAuth = Config.option(
  Config.Redacted('GITHUB_TOKEN').pipe(Config.orElse(() => Config.Redacted('GH_TOKEN'))),
).pipe(
  Effect.orElseSucceed(() => Option.none<Redacted.Redacted>()),
  Effect.map(
    Option.match({
      onNone: (): Record<string, string> => ({}),
      onSome: (t) => ({ authorization: `Bearer ${Redacted.value(t)}` }),
    }),
  ),
)

const githubGet = (query: string, limit: number) =>
  unlessLimited(GitHubLimit, GITHUB_SEARCH, (onResponse) =>
    Effect.flatMap(githubAuth, (headers) =>
      getJson(
        GitHubRepos,
        GITHUB_SEARCH,
        { q: query, per_page: String(limit) },
        {
          headers,
          onResponse,
        },
      ),
    ),
  )

// GitHub repository search, keyless (10 a minute per IP) unless a token is set.
// Best-match order; stars go in the description so a ranker can weigh them.
export const githubSearch = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  githubGet(query, limit).pipe(
    Effect.map(({ items }) =>
      items.map((r) => ({
        title: r.full_name,
        url: r.html_url,
        description: [r.description, `${r.stargazers_count} stars`].filter(Boolean).join(' · '),
      })),
    ),
  )

const FeedSearch = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optional(Schema.NullOr(Schema.String)),
      description: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
)

// feedsearch.dev: the feeds a site publishes. `query` is the site URL or host.
export const feedSearch = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(FeedSearch, 'https://feedsearch.dev/api/v1/search', { url: query }).pipe(
    Effect.map((feeds) =>
      feeds.slice(0, limit).map((f) => ({
        title: f.title ?? f.url,
        url: f.url,
        description: f.description ?? '',
      })),
    ),
  )
