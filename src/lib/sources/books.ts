// Keyless book search: Open Library's search.json (no key; the polite User-Agent
// from polite.ts is what the project asks for). A work's key reads /works/OL45804W.
import { Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

const OpenLibrary = Schema.fromJsonString(
  Schema.Struct({
    docs: Schema.Array(
      Schema.Struct({
        key: Schema.String,
        title: Schema.String,
        author_name: Schema.optional(Schema.Array(Schema.String)),
        first_publish_year: Schema.optional(Schema.Number),
      }),
    ),
  }),
)

const ORIGIN = 'https://openlibrary.org'

// "Frank Herbert, first published 1965"; either part is left out when the work lacks it.
const describe = (authors: ReadonlyArray<string> = [], year?: number) =>
  [authors.join(', '), year ? `first published ${year}` : ''].filter(Boolean).join(', ')

export const openLibrary = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(OpenLibrary, `${ORIGIN}/search.json`, {
    q: query,
    limit: String(limit),
    fields: 'key,title,author_name,first_publish_year',
  }).pipe(
    Effect.map(({ docs }) =>
      docs.map((d) => ({
        title: d.title,
        url: `${ORIGIN}${d.key}`,
        description: describe(d.author_name, d.first_publish_year),
      })),
    ),
  )
