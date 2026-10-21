// SEARCH fallback chain + Crossref/OpenAlex contract, against a real local
// Bun.serve fixture (WEBULAR_SOURCE_ORIGIN swaps every endpoint origin, the
// DuckDuckGo one included). Crossref and OpenAlex bodies are recorded live
// responses, trimmed to two items. No mocks.
import { describe, expect, test } from 'bun:test'
import { Config, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'

const Output = Schema.fromJsonString(
  Schema.Struct({
    count: Schema.Number,
    source: Schema.optional(Schema.String),
    results: Schema.Array(
      Schema.Struct({ title: Schema.String, url: Schema.String, description: Schema.String }),
    ),
  }),
)
type Output = typeof Output.Type

const body = (name: string) =>
  Effect.promise(() => Bun.file(`${import.meta.dir}/../fixtures/${name}`).text())

const json = (text: string) =>
  new Response(text, { headers: { 'content-type': 'application/json' } })

// '/html/' (DuckDuckGo) has no route, so the web source gets a 404; wikipedia
// and arxiv answer empty, hackernews fails. Crossref sends `query`, OpenAlex
// sends `search`; both use /works.
const routes = (crossref: string, openalex: string): Routes => ({
  '/w/api.php': () => Response.json({ query: { search: [] } }),
  '/api/v1/search': () => new Response('boom', { status: 500 }),
  '/api/query': () => new Response('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'),
  '/works': (_req, url) => json(url.searchParams.has('search') ? openalex : crossref),
})

const fixture = Effect.fn('fixture')(function* (crossrefUp: boolean) {
  const empty = JSON.stringify({ message: { items: [] } })
  const crossref = crossrefUp ? yield* body('crossref-works.json') : empty
  const openalex = yield* body('openalex-works.json')
  return yield* Effect.acquireRelease(
    Effect.sync(() => startFixture(() => routes(crossref, openalex))),
    (fx) => Effect.sync(() => fx.stop()),
  )
})

const search = (args: string[], crossrefUp: boolean, check: (d: Output, webHits: number) => void) =>
  Effect.gen(function* () {
    const fx = yield* fixture(crossrefUp)
    // Windows spells the variable `Path`.
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: fx.origin }
    const run = yield* Effect.promise(() =>
      runCli('src/commands/search.ts', ['bun', ...args, '--json'], { env }),
    )
    expect(run.code).toBe(0)
    check(yield* Schema.decodeUnknownEffect(Output)(run.out), fx.hits('/html/'))
  }).pipe(Effect.scoped, Effect.runPromise)

describe('webular search — fallback chain for the default web source', () => {
  test(
    'falls through failing and empty sources to crossref',
    () =>
      search(['--limit', '2'], true, (data, webHits) => {
        expect(webHits).toBeGreaterThan(0)
        expect(data.source).toBe('crossref')
        expect(data.count).toBe(2)
      }),
    30_000,
  )

  test(
    'an empty crossref answer falls through to openalex',
    () => search([], false, (data) => expect(data.source).toBe('openalex')),
    30_000,
  )
})

describe('webular search --source crossref|openalex', () => {
  test(
    'crossref: first title, DOI URL, tag-free abstract; no source field',
    () =>
      search(['--source', 'crossref'], true, ({ source, results: [first] }) => {
        expect(source).toBeUndefined()
        expect(first?.title).toStartWith('IMPROVING MICROINTERFACE PERFORMANCE')
        expect(first?.url).toBe('https://doi.org/10.23939/csn2025.01.272')
        expect(first?.description).toStartWith('Abstract: This paper explores')
        expect(first?.description).not.toContain('<')
      }),
    15_000,
  )

  test(
    'openalex: DOI URL or OpenAlex id, abstract rebuilt in word order',
    () =>
      search(['--source', 'openalex'], true, ({ results: [first, second] }) => {
        expect(first?.title).toBe('Comparison of JavaScript runtimes NodeJS, Deno and Bun')
        expect(first?.url).toBe('https://openalex.org/W7198347908')
        expect(first?.description).toStartWith('Práce se zabývá podrobným srovnáním')
        expect(second?.url).toBe('https://doi.org/10.5281/zenodo.7945165')
      }),
    15_000,
  )
})
