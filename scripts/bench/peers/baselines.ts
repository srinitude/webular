// Free local baselines: SearXNG search plus five scrapers (Trafilatura, curl +
// html2text, Crawl4AI, ScrapeGraphAI's fetch node, Mozilla Readability). Each
// is probed once when built; a missing tool gets `skip`, never a fake result.
import { Config, Effect, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import { ChildProcessSpawner } from 'effect/process'
import { runProc } from '../../../src/core/proc.ts'
import { htmlToArticle } from '../../../src/lib/html.ts'
import type { Provider, TaskInput } from './model.ts'
import { bytes, fail, out } from './peers.ts'
import { CALL_TIMEOUT_MS } from './timeout.ts'

type Argv = [string, ...string[]]
type Probe = readonly [name: string, argv: Argv]
type Spawner = ChildProcessSpawner.ChildProcessSpawner['Service']

const TIMEOUT_MS = CALL_TIMEOUT_MS
const DEFAULT_SEARXNG = 'http://localhost:8888'

// ScrapeGraphAI's fetch node loads a page with no model: the free part of it.
const SCRAPEGRAPH_PY =
  'import sys; from scrapegraphai.nodes import FetchNode; ' +
  'n = FetchNode(input="url", output=["doc"], node_config={"headless": True}); ' +
  'print(n.execute({"url": sys.argv[1]})["doc"][0].page_content)'

const exec = (spawner: Spawner, argv: Argv, stdin?: string) =>
  runProc(
    argv,
    stdin === undefined ? { timeoutMs: TIMEOUT_MS } : { timeoutMs: TIMEOUT_MS, stdin },
  ).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    Effect.mapError(fail),
    Effect.filterOrFail(
      (r) => r.code === 0 && !r.timedOut,
      (r) => fail(`${argv[0]} exited ${r.code}${r.timedOut ? ' (timed out)' : ''}: ${r.stderr}`),
    ),
    Effect.map((r) => r.stdout),
  )

const firstMissing = (spawner: Spawner, probes: readonly Probe[]) =>
  Effect.forEach(
    probes,
    ([name, argv]) =>
      exec(spawner, argv).pipe(
        Effect.match({ onSuccess: () => undefined, onFailure: () => `not installed: ${name}` }),
      ),
    { concurrency: 4 },
  ).pipe(Effect.map((names) => names.find((n) => n !== undefined)))

const provider = (id: string, missing: string | undefined, jobs: Provider['jobs']): Provider => ({
  id,
  local: true,
  keyNames: [],
  jobs: missing === undefined ? jobs : {},
  ...(missing === undefined ? {} : { skip: missing }),
})

const scrapeCli =
  (spawner: Spawner, argvOf: (url: string) => Argv) =>
  ({ url = '' }: TaskInput) =>
    exec(spawner, argvOf(url)).pipe(Effect.map((text) => out(text, [url], 0, 0)))

const curlHtml2text =
  (spawner: Spawner) =>
  ({ url = '' }: TaskInput) =>
    exec(spawner, ['curl', '-sL', '--', url]).pipe(
      Effect.flatMap((html) => exec(spawner, ['html2text'], html)),
      Effect.map((text) => out(text, [url], 0, 0)),
    )

const readability =
  (client: HttpClient.HttpClient) =>
  ({ url = '' }: TaskInput) =>
    client.get(url).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.text),
      Effect.flatMap((html) => Effect.try(() => htmlToArticle(html).text)),
      Effect.timeout(CALL_TIMEOUT_MS),
      Effect.map((text) => out(text, [url], 0, 0)),
      Effect.mapError(fail),
    )

const Hits = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.String),
      content: Schema.optionalKey(Schema.String),
    }),
  ),
})

const searxQuery = (client: HttpClient.HttpClient, base: string) => (q: string) =>
  client
    .execute(
      HttpClientRequest.get(`${base}/search`).pipe(
        HttpClientRequest.setUrlParams({ q, format: 'json' }),
      ),
    )
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.json),
      Effect.flatMap(Schema.decodeUnknownEffect(Hits)),
    )

const searxng = (client: HttpClient.HttpClient, base: string) => {
  const query = searxQuery(client, base)
  const search = ({ query: q = '' }: TaskInput) =>
    query(q).pipe(
      Effect.timeout('30 seconds'),
      Effect.map((r) => {
        const hits = r.results.slice(0, 5)
        const text = hits.map((h) => `${h.title ?? ''}\n${h.url}\n${h.content ?? ''}`)
        return out(
          text.join('\n\n'),
          hits.map((h) => h.url),
          0,
          bytes(q),
        )
      }),
      Effect.mapError(fail),
    )
  return query('ping').pipe(
    Effect.timeout('5 seconds'),
    Effect.match({
      onSuccess: () => undefined,
      onFailure: () => `SearXNG not reachable at ${base}`,
    }),
    Effect.map((missing) => provider('searxng', missing, { search })),
  )
}

const cliBaseline = (
  spawner: Spawner,
  id: string,
  probes: readonly Probe[],
  scrape: (input: TaskInput) => ReturnType<ReturnType<typeof scrapeCli>>,
) => firstMissing(spawner, probes).pipe(Effect.map((m) => provider(id, m, { scrape })))

const cliBaselines = (spawner: Spawner) => {
  const probe = (name: string, argv: Argv = [name, '--help']): Probe => [name, argv]
  const scrape = (argvOf: (url: string) => Argv) => scrapeCli(spawner, argvOf)
  return [
    cliBaseline(
      spawner,
      'trafilatura',
      [probe('trafilatura')],
      scrape((u) => ['trafilatura', '-u', u, '--markdown']),
    ),
    cliBaseline(
      spawner,
      'curl-html2text',
      [probe('curl', ['curl', '--version']), probe('html2text')],
      curlHtml2text(spawner),
    ),
    cliBaseline(
      spawner,
      'crawl4ai',
      [probe('crawl4ai', ['crwl', '--help'])],
      scrape((u) => ['crwl', u, '-o', 'markdown']),
    ),
    cliBaseline(
      spawner,
      'scrapegraph',
      [probe('scrapegraphai', ['python3', '-c', 'import scrapegraphai'])],
      scrape((u) => ['python3', '-c', SCRAPEGRAPH_PY, u]),
    ),
  ]
}

export const baselines: Effect.Effect<
  readonly Provider[],
  never,
  ChildProcessSpawner.ChildProcessSpawner | HttpClient.HttpClient
> = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const client = yield* HttpClient.HttpClient
  const base = yield* Config.String('SEARXNG_URL').pipe(
    Config.withDefault(DEFAULT_SEARXNG),
    Effect.orElseSucceed(() => DEFAULT_SEARXNG),
  )
  const mozilla = provider('readability', undefined, { scrape: readability(client) })
  const built = yield* Effect.all([searxng(client, base), ...cliBaselines(spawner)], {
    concurrency: 6,
  })
  return [...built, mozilla]
})
