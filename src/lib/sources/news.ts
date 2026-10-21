// Keyless news and discussion search: Hacker News through Algolia (about 10,000
// requests an hour per IP) and the GDELT DOC 2.0 article list (worldwide news,
// about one request every five seconds; a plain-text refusal fails the decode).
import { Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

const HnAlgolia = Schema.fromJsonString(
  Schema.Struct({
    hits: Schema.Array(
      Schema.Struct({
        objectID: Schema.String,
        title: Schema.optional(Schema.NullOr(Schema.String)),
        url: Schema.optional(Schema.NullOr(Schema.String)),
        created_at: Schema.optional(Schema.String),
        points: Schema.optional(Schema.NullOr(Schema.Number)),
      }),
    ),
  }),
)

const Gdelt = Schema.fromJsonString(
  Schema.Struct({
    articles: Schema.Array(
      Schema.Struct({
        url: Schema.String,
        title: Schema.String,
        seendate: Schema.optional(Schema.String),
        domain: Schema.optional(Schema.String),
      }),
    ),
  }),
)

const HN_ITEM = 'https://news.ycombinator.com/item?id='

// A story with no link (Ask HN) points at its discussion page.
export const hnAlgolia = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(HnAlgolia, 'https://hn.algolia.com/api/v1/search', {
    query,
    tags: 'story',
    hitsPerPage: String(limit),
  }).pipe(
    Effect.map(({ hits }) =>
      hits.map((h) => ({
        title: h.title ?? '',
        url: h.url || `${HN_ITEM}${h.objectID}`,
        description: `Hacker News, ${h.points ?? 0} points: ${HN_ITEM}${h.objectID}`,
        ...(h.created_at ? { published: h.created_at } : {}),
      })),
    ),
  )

// GDELT dates read 20261021T081500Z; Date.parse needs the dashes and colons.
const isoDate = (s: string) =>
  `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 11)}:${s.slice(11, 13)}:${s.slice(13)}`

export const gdelt = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Gdelt, 'https://api.gdeltproject.org/api/v2/doc/doc', {
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(limit),
    sort: 'datedesc',
  }).pipe(
    Effect.map(({ articles }) =>
      articles.map((a) => ({
        title: a.title,
        url: a.url,
        description: a.domain ?? '',
        ...(a.seendate ? { published: isoDate(a.seendate) } : {}),
      })),
    ),
  )
