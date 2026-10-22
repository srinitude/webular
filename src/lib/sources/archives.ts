// Archive adapters: Wayback availability, Wayback CDX, Library of Congress.
// Keyless public JSON APIs. The Wayback adapters treat `query` as the URL to
// look up; Library of Congress treats it as search text.
import { Config, Effect, Schema } from 'effect'
import { fetchText } from '../../core/http.ts'
import { asOfStamp } from '../as-of.ts'
import { getJson, type Hit, politely, sourceUrl } from './polite.ts'

const WaybackAvailable = Schema.fromJsonString(
  Schema.Struct({
    archived_snapshots: Schema.Struct({
      closest: Schema.optional(
        Schema.Struct({ url: Schema.String, timestamp: Schema.String, status: Schema.String }),
      ),
    }),
  }),
)

const lookup = (query: string, limit: number) =>
  asOfStamp.pipe(
    Effect.flatMap((timestamp) =>
      getJson(WaybackAvailable, 'https://archive.org/wayback/available', {
        url: query,
        ...(timestamp ? { timestamp } : {}),
      }),
    ),
    Effect.map(({ archived_snapshots: { closest } }) =>
      closest && limit > 0
        ? [
            {
              title: `Wayback snapshot of ${query}`,
              url: closest.url,
              description: `${closest.timestamp} HTTP ${closest.status}`,
            },
          ]
        : [],
    ),
  )

// github.com/<owner>/<repo>/blob/<ref>/<path> -> raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>.
// A tree URL names a directory, which the raw host cannot serve.
const BLOB = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/
const RAW_MAX_BYTES = 1_048_576
const rawTimeoutMs = Config.Int('WEBULAR_GITHUB_RAW_TIMEOUT_MS').pipe(Config.withDefault(10_000))

// A repo file's text from raw.githubusercontent.com, 10 s and 1 MB at most.
const githubRaw = (blobUrl: string): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    const m = BLOB.exec(blobUrl)
    if (!m) return yield* Effect.fail(new Error(`not a github blob url: ${blobUrl}`))
    const url = yield* sourceUrl(`https://raw.githubusercontent.com/${m[1]}/${m[2]}`, {})
    const get = fetchText(url, { timeoutMs: yield* rawTimeoutMs, maxBytes: RAW_MAX_BYTES })
    return yield* politely('raw.githubusercontent.com', get)
  })

const rawHit = (blobUrl: string) =>
  Effect.map(githubRaw(blobUrl), (text) => [
    { title: `GitHub raw file ${blobUrl}`, url: blobUrl, description: text },
  ])

// A github.com blob URL the archive has no snapshot of (or fails on) falls back
// to the repo's raw file; every other query keeps the archive's own outcome.
export const waybackAvailable = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  !BLOB.test(query) || limit <= 0
    ? lookup(query, limit)
    : lookup(query, limit).pipe(
        Effect.catch(() => Effect.succeed<Hit[]>([])),
        Effect.flatMap((hits) => (hits.length > 0 ? Effect.succeed(hits) : rawHit(query))),
      )

// output=json is an array of string rows; row 0 names the columns (empty
// array when the URL has no captures).
const Cdx = Schema.fromJsonString(Schema.Array(Schema.Array(Schema.String)))

export const waybackCdx = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Cdx, 'https://web.archive.org/cdx/search/cdx', {
    url: query,
    output: 'json',
    limit: String(limit),
  }).pipe(
    Effect.map((rows) =>
      rows.slice(1, limit + 1).map(([, timestamp = '', original = '', mime = '', status = '']) => ({
        title: original,
        url: `https://web.archive.org/web/${timestamp}/${original}`,
        description: `${timestamp} ${mime} HTTP ${status}`,
      })),
    ),
  )

const LibraryOfCongress = Schema.fromJsonString(
  Schema.Struct({
    results: Schema.Array(
      Schema.Struct({
        title: Schema.optional(Schema.String),
        url: Schema.optional(Schema.String),
        id: Schema.optional(Schema.String),
        description: Schema.optional(Schema.Array(Schema.String)),
      }),
    ),
  }),
)

export const libraryOfCongress = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(LibraryOfCongress, 'https://www.loc.gov/search/', {
    fo: 'json',
    q: query,
    c: String(limit),
  }).pipe(
    Effect.map(({ results }) =>
      results.flatMap((r) => {
        const url = r.url ?? r.id
        return url ? [{ title: r.title ?? '', url, description: r.description?.[0] ?? '' }] : []
      }),
    ),
  )

const CollInfo = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ id: Schema.String, 'cdx-api': Schema.String })),
)

const CcRow = Schema.fromJsonString(
  Schema.Struct({
    url: Schema.String,
    timestamp: Schema.String,
    status: Schema.optional(Schema.String),
    mime: Schema.optional(Schema.String),
  }),
)

// Common Crawl URL index: the first crawl collinfo.json lists, then that
// crawl's CDX API for `query` (a URL or a prefix like example.com/docs/*). It
// answers one JSON object per line. Two requests to one host, spaced by politely().
export const commonCrawlCdx = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  Effect.gen(function* () {
    const [crawl] = yield* getJson(CollInfo, 'https://index.commoncrawl.org/collinfo.json', {})
    if (!crawl) return []
    const text = yield* getJson(Schema.String, crawl['cdx-api'], {
      url: query,
      output: 'json',
      limit: String(limit),
      fl: 'url,timestamp,status,mime',
    })
    const lines = text.split('\n').filter((line) => line.trim() !== '')
    const rows = yield* Effect.forEach(lines, (line) => Schema.decodeUnknownEffect(CcRow)(line), {
      concurrency: 1,
    })
    return rows.map((r) => ({
      title: r.url,
      url: r.url,
      description: `${crawl.id} ${r.timestamp} ${r.mime ?? ''} HTTP ${r.status ?? ''}`,
    }))
  })
