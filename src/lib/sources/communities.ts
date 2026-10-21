// Community search adapters: Stack Exchange, Reddit, Bluesky. All keyless
// public JSON APIs. WEBULAR_SOURCE_ORIGIN swaps each origin (path kept) so
// tests run against a local fixture; WEBULAR_MAILTO joins the User-Agent.
// Hacker News lives in sources-search.ts; Lobsters has no JSON search
// (search is HTML-only, hottest.json is not query-based), so it is skipped.
import { Effect, Schema } from 'effect'
import { plain } from '../sources-search.ts'
import { getJson, type Hit } from './polite.ts'

const StackExchange = Schema.fromJsonString(
  Schema.Struct({
    items: Schema.Array(
      Schema.Struct({
        title: Schema.String,
        link: Schema.String,
        tags: Schema.optional(Schema.Array(Schema.String)),
        score: Schema.optional(Schema.Number),
      }),
    ),
  }),
)

export const stackExchange = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(StackExchange, 'https://api.stackexchange.com/2.3/search/advanced', {
    q: query,
    site: 'stackoverflow',
    pagesize: String(limit),
    order: 'desc',
    sort: 'relevance',
  }).pipe(
    Effect.map(({ items }) =>
      items.map((q) => ({
        title: plain(q.title),
        url: q.link,
        description: [q.tags?.join(', '), q.score === undefined ? '' : `score ${q.score}`]
          .filter(Boolean)
          .join(' · '),
      })),
    ),
  )

const Reddit = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Struct({
      children: Schema.Array(
        Schema.Struct({
          data: Schema.Struct({
            title: Schema.String,
            permalink: Schema.String,
            selftext: Schema.optional(Schema.String),
          }),
        }),
      ),
    }),
  }),
)

export const reddit = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Reddit, 'https://www.reddit.com/search.json', { q: query, limit: String(limit) }).pipe(
    Effect.map(({ data }) =>
      data.children.map(({ data: post }) => ({
        title: post.title,
        url: `https://www.reddit.com${post.permalink}`,
        description: (post.selftext ?? '').slice(0, 300),
      })),
    ),
  )

const Bluesky = Schema.fromJsonString(
  Schema.Struct({
    posts: Schema.Array(
      Schema.Struct({
        uri: Schema.String,
        author: Schema.Struct({ handle: Schema.String }),
        record: Schema.Struct({ text: Schema.String }),
      }),
    ),
  }),
)

export const bluesky = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Bluesky, 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts', {
    q: query,
    limit: String(limit),
  }).pipe(
    Effect.map(({ posts }) =>
      posts.map((p) => ({
        title: p.record.text.split('\n')[0]?.slice(0, 120) ?? '',
        url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`,
        description: p.record.text,
      })),
    ),
  )
