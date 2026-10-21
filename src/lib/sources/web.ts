// Keyless general and entity search: Marginalia (independent small-web index,
// shared "public" key, about 15 queries a minute) and Wikidata entity search
// (CC0 data). Wikipedia lives in sources-search.ts.
import { Clock, Config, Context, Effect, Option, Redacted, Schema } from 'effect'
import { HttpStatusError } from '../../core/http-body.ts'
import { getJson, type Hit } from './polite.ts'

const Marginalia = Schema.fromJsonString(
  Schema.Struct({
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

export const marginalia = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Marginalia, `https://api.marginalia.nu/public/search/${encodeURIComponent(query)}`, {
    count: String(limit),
  }).pipe(
    Effect.map(({ results }) =>
      results.map((r) => ({ title: r.title, url: r.url, description: r.description ?? '' })),
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
// rate-limit headers. A Reference, so every caller shares it unless a test gives its own.
export const GitHubLimit = Context.Reference<{ until: number }>('webular/sources/GitHubLimit', {
  defaultValue: () => ({ until: 0 }),
})

// When the pool is spent: retry-after on a 403/429, else x-ratelimit-reset once
// x-ratelimit-remaining is 0, else a minute on a bare 429 (GitHub's own advice).
const spentUntil = (res: Response, now: number) => {
  const after = Number(res.headers.get('retry-after'))
  if ((res.status === 403 || res.status === 429) && after > 0) return now + after * 1000
  if (res.headers.get('x-ratelimit-remaining') === '0')
    return Number(res.headers.get('x-ratelimit-reset')) * 1000
  return res.status === 429 ? now + 60_000 : 0
}

const skipped = (until: number) =>
  new HttpStatusError({
    url: GITHUB_SEARCH,
    status: 429,
    statusText: `rate limited until ${new Date(until).toISOString()}, skipped`,
  })

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

// After a request (success or failure), push the block out from the last response seen.
const markSpent = (block: { until: number }, seen: { res?: Response }) =>
  Effect.flatMap(Clock.currentTimeMillis, (now) =>
    Effect.sync(() => {
      if (seen.res) block.until = Math.max(block.until, spentUntil(seen.res, now))
    }),
  )

const githubGet = (query: string, limit: number) =>
  Effect.gen(function* () {
    const block = yield* GitHubLimit
    if ((yield* Clock.currentTimeMillis) < block.until)
      return yield* Effect.fail(skipped(block.until))
    const seen: { res?: Response } = {}
    const params = { q: query, per_page: String(limit) }
    const opts = {
      headers: yield* githubAuth,
      onResponse: (res: Response) => {
        seen.res = res
      },
    }
    return yield* Effect.ensuring(
      getJson(GitHubRepos, GITHUB_SEARCH, params, opts),
      markSpent(block, seen),
    )
  })

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
