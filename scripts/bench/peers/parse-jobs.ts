// Parse job adapters. Firecrawl parses a document URL itself (POST /v2/scrape
// on a PDF, markdown format). webular parses a local file, so its arm saves the
// same URL to a scoped temp file first and runs its parse workflow on that file.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect, FileSystem, Path, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import type { BenchError, Provider } from './model.ts'
import { fail, out, type Post } from './peers.ts'

// Firecrawl scrape: 1 credit at $83 / 100,000. ponytail: PDFs bill per page; the
// gold PDF is one page, so a larger gold file needs a per-page count here.
const FIRECRAWL_PARSE_USD = 83 / 100_000

type Jobs = Provider['jobs']
const FcMarkdown = Schema.Struct({ data: Schema.Struct({ markdown: Schema.String }) })
export const ParseOut = Schema.Struct({ markdown: Schema.String })

export const firecrawlParse = (post: Post, key: string): Jobs => ({
  parse: ({ url = '' }) =>
    post(
      'https://api.firecrawl.dev/v2/scrape',
      { authorization: `Bearer ${key}` },
      { url, formats: ['markdown'] },
      FcMarkdown,
    ).pipe(
      Effect.map(({ r, sentBytes }) => out(r.data.markdown, [url], FIRECRAWL_PARSE_USD, sentBytes)),
    ),
})

// The document saved under a temp folder that goes away with the scope.
const saved = (url: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const res = yield* HttpClient.get(url).pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'bench-parse-' })
    const file = path.join(dir, `doc${path.extname(new URL(url).pathname)}`)
    yield* fs.writeFile(file, new Uint8Array(yield* res.arrayBuffer))
    return file
  })

/** `run` is the webular parse workflow (or a stand-in): file path in, markdown out. */
export const webularParse = (
  run: (file: string) => Effect.Effect<{ markdown: string }, BenchError>,
): Jobs => ({
  parse: ({ url = '' }) =>
    saved(url).pipe(
      Effect.flatMap(run),
      Effect.map((r) => out(r.markdown, [url], 0, 0)),
      Effect.scoped,
      Effect.provide([FetchHttpClient.layer, BunServices.layer]),
      Effect.mapError(fail),
    ),
})
