// Benchmark task set: local fixtures (free, deterministic), public pages,
// search, and SimpleQA/FRAMES-style questions with known answers. A plan file
// (BENCH_PLAN, default bench/benchmark-plan.json) adds tasks and metrics.
import { Effect, Schema } from 'effect'
import { startFixture } from '../../../tests/_support/fixture.ts'
import { actPage, actTasks } from './act-tasks.ts'
import { batchTasks } from './batch-tasks.ts'
import { crawlRoutes, crawlTasks } from './crawl-tasks.ts'
import { extractTasks } from './extract-tasks.ts'
import { mapTasks } from './map-tasks.ts'
import { mediaTasks } from './media-tasks.ts'
import { type MetricDef, Plan, type Task } from './model.ts'
import { monitorRoute, monitorTasks } from './monitor-tasks.ts'
import { parseTasks } from './parse-tasks.ts'
import { researchTasks } from './research-tasks.ts'
import { summarizeTasks } from './summarize-tasks.ts'

const html = (body: string) =>
  new Response(
    `<!doctype html><html><head><title>Fixture</title></head><body>${body}</body></html>`,
    {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  )

const chrome = (main: string) => `
<nav><a href="/">Home</a> <a href="/about">About</a> Main menu</nav>
<div class="cookie">We use cookies. Accept all cookies?</div>
<main><article>${main}</article></main>
<aside>Sponsored: buy discount widgets now</aside>
<footer>Subscribe to our newsletter. Copyright Fixture Media.</footer>`

const article = chrome(`<h1>Tidal Power in the Bay of Fundy</h1>
<p>The Bay of Fundy has the highest tides on Earth, with a range that can reach 16 metres.</p>
<p>Engineers have tested in-stream turbines there since 2009 because the currents are strong and predictable.</p>
<p>Each tidal cycle moves about 100 billion tonnes of seawater in and out of the bay.</p>`)

const table = chrome(`<h1>Dense Metals</h1><p>Symbols of three dense metals.</p>
<table><thead><tr><th>Element</th><th>Symbol</th></tr></thead>
<tbody><tr><td>Tungsten</td><td>W</td></tr><tr><td>Osmium</td><td>Os</td></tr><tr><td>Iridium</td><td>Ir</td></tr></tbody></table>`)

const jsPage = chrome(`<div id="app">Loading...</div>
<script>document.getElementById('app').innerHTML = '<h1>Client Rendered</h1><p>Rendered by script: the launch code is AURORA-7.</p>'</script>`)

export const startPages = () =>
  startFixture(() => ({
    '/article': () => html(article),
    '/table': () => html(table),
    '/js': () => html(jsPage),
    ...crawlRoutes,
    '/act': () => html(actPage),
    '/monitor': monitorRoute(),
  }))

const noChrome = {
  kind: 'excludes' as const,
  values: ['Subscribe to our newsletter', 'Accept all cookies', 'Sponsored'],
}

const qa = (id: string, query: string, answers: string[]): Task => ({
  id,
  job: 'answer',
  suite: 'qa',
  input: { query },
  checks: [{ kind: 'contains', values: answers }],
  answers,
})

export const builtinTasks: readonly Task[] = [
  {
    id: 'scrape-fixture-article',
    job: 'scrape',
    suite: 'scrape-fidelity',
    localOnly: true,
    input: { url: '{fixture}/article' },
    checks: [
      { kind: 'contains', values: ['16 metres'] },
      { kind: 'contains', values: ['100 billion tonnes'] },
      noChrome,
    ],
  },
  {
    id: 'scrape-fixture-table',
    job: 'scrape',
    suite: 'scrape-fidelity',
    localOnly: true,
    input: { url: '{fixture}/table' },
    checks: [{ kind: 'regex', values: ['\\|\\s*Tungsten\\s*\\|\\s*W\\s*\\|'] }, noChrome],
  },
  {
    id: 'scrape-fixture-js',
    job: 'scrape',
    suite: 'hard-pages',
    localOnly: true,
    input: { url: '{fixture}/js' },
    checks: [{ kind: 'contains', values: ['AURORA-7'] }],
  },
  {
    id: 'scrape-example-com',
    job: 'scrape',
    suite: 'scrape-fidelity',
    input: { url: 'https://example.com/' },
    checks: [{ kind: 'contains', values: ['Example Domain'] }],
  },
  {
    id: 'scrape-wikipedia-lovelace',
    job: 'scrape',
    suite: 'scrape-fidelity',
    input: { url: 'https://en.wikipedia.org/wiki/Ada_Lovelace' },
    checks: [
      { kind: 'contains', values: ['Analytical Engine'] },
      { kind: 'excludes', values: ['Jump to content'] },
    ],
  },
  {
    id: 'scrape-pdf-attention',
    job: 'scrape',
    suite: 'hard-pages',
    input: { url: 'https://arxiv.org/pdf/1706.03762' },
    checks: [{ kind: 'contains', values: ['scaled dot-product attention'] }],
  },
  {
    id: 'search-readability-repo',
    job: 'search',
    suite: 'search',
    input: { query: 'mozilla readability library github' },
    checks: [{ kind: 'urlMatches', values: ['github\\.com/mozilla/readability'] }],
  },
  {
    id: 'search-bun-runtime',
    job: 'search',
    suite: 'search',
    input: { query: 'Bun JavaScript runtime official site' },
    checks: [{ kind: 'urlMatches', values: ['^https://bun\\.(sh|com)'] }],
  },
  {
    id: 'search-effect-ts',
    job: 'search',
    suite: 'search',
    input: { query: 'Effect TypeScript library documentation' },
    checks: [{ kind: 'urlMatches', values: ['effect\\.website'] }],
  },
  qa(
    'qa-lovelace-year',
    'In what year were Ada Lovelace notes on the Analytical Engine published?',
    ['1843'],
  ),
  qa('qa-solitude-author', "Who wrote the novel 'One Hundred Years of Solitude'?", [
    'Garcia Marquez',
  ]),
  qa('qa-australia-capital', 'What is the capital city of Australia?', ['Canberra']),
  qa('qa-atomic-79', 'Which chemical element has atomic number 79?', ['gold']),
  qa(
    'qa-heisenberg-birthplace',
    'In which city was the physicist who formulated the uncertainty principle born?',
    ['Wurzburg', 'Wuerzburg'],
  ),
  qa(
    'qa-everest-height',
    'What is the height of Mount Everest in meters according to the 2020 survey?',
    ['8,848', '8848'],
  ),
  // Spot misses: trailing navigational filler, and a title split at "in the".
  {
    id: 'search-bun-docs-homepage',
    job: 'search',
    suite: 'search',
    input: { query: 'Bun runtime documentation homepage' },
    checks: [{ kind: 'urlMatches', values: ['^https://bun\\.(sh|com)'] }],
  },
  qa('qa-cholera-author', 'Who wrote the novel Love in the Time of Cholera?', ['Garcia Marquez']),
  ...mapTasks,
  ...extractTasks,
  ...researchTasks,
  ...summarizeTasks,
  ...mediaTasks,
  ...parseTasks,
  ...crawlTasks,
  ...batchTasks,
  ...actTasks,
  ...monitorTasks,
]

export const loadPlan = (path: string) =>
  Effect.gen(function* () {
    const file = Bun.file(path)
    if (!(yield* Effect.promise(() => file.exists())))
      return { tasks: [], metrics: [], note: `no plan at ${path}` }
    const raw = yield* Effect.tryPromise(() => file.json())
    const plan = yield* Schema.decodeUnknownEffect(Plan)(raw)
    return {
      tasks: plan.tasks ?? [],
      metrics: plan.metrics ?? ([] as MetricDef[]),
      note: `plan ${path}`,
    }
  }).pipe(
    Effect.catch((e) =>
      Effect.succeed({
        tasks: [] as Task[],
        metrics: [] as MetricDef[],
        note: `plan unreadable: ${String(e)}`,
      }),
    ),
  )
