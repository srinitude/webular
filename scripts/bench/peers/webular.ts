// webular's own provider: every job runs in-process through its real Mastra
// workflow, with no key and no cost. The peers sit beside it in providers.ts.
import { Effect, Schema } from 'effect'
import { actWorkflow } from '../../../src/workflows/act.ts'
import { answerWorkflow } from '../../../src/workflows/answer.ts'
import { batchWorkflow } from '../../../src/workflows/batch.ts'
import { crawlWorkflow } from '../../../src/workflows/crawl.ts'
import { extractWorkflow } from '../../../src/workflows/extract.ts'
import { mapWorkflow } from '../../../src/workflows/map.ts'
import { mediaWorkflow } from '../../../src/workflows/media.ts'
import { monitorWorkflow } from '../../../src/workflows/monitor.ts'
import { parseWorkflow } from '../../../src/workflows/parse.ts'
import { researchWorkflow } from '../../../src/workflows/research.ts'
import { scrapeWorkflow } from '../../../src/workflows/scrape.ts'
import { searchWorkflow } from '../../../src/workflows/search.ts'
import { summarizeWorkflow } from '../../../src/workflows/summarize.ts'
import { actGoal } from './act-tasks.ts'
import { batchTargets, pagesOut } from './batch-jobs.ts'
import { webularCrawl } from './crawl-jobs.ts'
import { extracted } from './extract-jobs.ts'
import { extractSpecs } from './extract-tasks.ts'
import { listed, MAP_LIMIT } from './map-jobs.ts'
import { MediaOut, mediaInput, savedImage } from './media-jobs.ts'
import type { Provider } from './model.ts'
import { MonitorOut, webularMonitor } from './monitor-jobs.ts'
import { ParseOut, webularParse } from './parse-jobs.ts'
import { bytes, fail, out } from './peers.ts'
import { SUMMARY_SENTENCES, SummarizeOut, summarized } from './summarize-jobs.ts'

interface Flow {
  createRun(): Promise<{
    start(a: { inputData: unknown }): Promise<{ status: string; result?: unknown; error?: Error }>
  }>
}

const runFlow = <A>(flow: unknown, schema: Schema.Codec<A>, inputData: unknown) =>
  Effect.tryPromise({ try: () => (flow as Flow).createRun(), catch: fail }).pipe(
    Effect.flatMap((run) =>
      Effect.tryPromise({ try: () => run.start({ inputData }), catch: fail }),
    ),
    Effect.filterOrFail(
      (o) => o.status === 'success',
      (o) => fail(o.error?.message ?? o.status),
    ),
    Effect.flatMap((o) => Schema.decodeUnknownEffect(schema)(o.result).pipe(Effect.mapError(fail))),
  )

const Ref = Schema.Struct({ title: Schema.String, url: Schema.String })
const SearchOut = Schema.Struct({
  results: Schema.Array(Schema.Struct({ ...Ref.fields, description: Schema.String })),
})
const ScrapeOut = Schema.Struct({ markdown: Schema.String })
const MapOut = Schema.Struct({ links: Schema.Array(Schema.String) })
const ExtractOut = Schema.Struct({ data: Schema.Record(Schema.String, Schema.String) })
const AnswerOut = Schema.Struct({ answer: Schema.String, sources: Schema.Array(Ref) })
const ResearchOut = Schema.Struct({ report: Schema.String, sources: Schema.Array(Ref) })

const BatchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({ url: Schema.String, title: Schema.optionalKey(Schema.String) }),
  ),
})

const searchJobs: Provider['jobs'] = {
  ...webularMonitor((i) => runFlow(monitorWorkflow, MonitorOut, i)),
  search: ({ query = '' }) =>
    runFlow(searchWorkflow, SearchOut, { query, limit: 5 }).pipe(
      Effect.map((r) => ({
        text: r.results.map((h) => `${h.title}\n${h.url}\n${h.description}`).join('\n\n'),
        urls: r.results.map((h) => h.url),
        citations: [],
        costUsd: 0,
        sentBytes: bytes(query),
      })),
    ),
  scrape: ({ url = '' }) =>
    runFlow(scrapeWorkflow, ScrapeOut, { url }).pipe(
      Effect.map((r) => ({
        text: r.markdown,
        urls: [url],
        citations: [],
        costUsd: 0,
        sentBytes: 0,
      })),
    ),
}

const pageJobs: Provider['jobs'] = {
  map: ({ url = '' }) =>
    runFlow(mapWorkflow, MapOut, { url, limit: MAP_LIMIT }).pipe(
      Effect.map((r) => listed(r.links, 0, 0)),
    ),
  extract: ({ url = '' }) =>
    runFlow(extractWorkflow, ExtractOut, { url, fields: extractSpecs[url]?.fields }).pipe(
      Effect.map((r) => extracted(r.data, url, 0, 0)),
    ),
  crawl: ({ url = '' }) => webularCrawl(runFlow, crawlWorkflow, scrapeWorkflow, url),
  // The batch workflow reports each page's title, and no title for a failed page.
  batch: ({ url = '' }) =>
    runFlow(batchWorkflow, BatchOut, { urls: batchTargets(url) }).pipe(
      Effect.map((r) =>
        pagesOut(
          r.results.map((h) => ({ url: h.url, text: h.title ?? '' })),
          0,
          0,
        ),
      ),
    ),
  media: ({ url = '' }) =>
    mediaInput(url).pipe(
      Effect.flatMap((input) => runFlow(mediaWorkflow, MediaOut, input)),
      Effect.flatMap((r) => savedImage(r, url)),
    ),
  ...webularParse((file) => runFlow(parseWorkflow, ParseOut, { file })),
  summarize: ({ url = '' }) =>
    runFlow(summarizeWorkflow, SummarizeOut, { url, sentences: SUMMARY_SENTENCES }).pipe(
      Effect.map((r) => summarized(r.summary, url, 0, 0)),
    ),
}

const ActOut = Schema.Struct({
  url: Schema.String,
  snapshot: Schema.String,
  next: Schema.optionalKey(Schema.String),
})

const answerJobs: Provider['jobs'] = {
  // The act workflow opens, snapshots, and closes; it clicks nothing itself.
  act: ({ url = '' }) =>
    runFlow(actWorkflow, ActOut, { url, goal: actGoal }).pipe(
      Effect.map((r) => out(`${r.snapshot}\n${r.next ?? ''}`, [url], 0, 0)),
    ),
  // Citations carry no text: the answer workflow returns only title and url.
  answer: ({ query = '' }) =>
    runFlow(answerWorkflow, AnswerOut, { query, sources: 3, sentences: 3 }).pipe(
      Effect.map((r) => ({
        text: r.answer,
        urls: r.sources.map((s) => s.url),
        citations: r.sources.map((s) => ({ url: s.url, text: '' })),
        costUsd: 0,
        sentBytes: bytes(query),
      })),
    ),
  research: ({ query = '' }) =>
    runFlow(researchWorkflow, ResearchOut, { topic: query, depth: 3, sentences: 2 }).pipe(
      Effect.map((r) => ({
        text: r.report,
        urls: r.sources.map((s) => s.url),
        citations: [],
        costUsd: 0,
        sentBytes: bytes(query),
      })),
    ),
}

export const webular: Provider = {
  id: 'webular',
  local: true,
  keyNames: [],
  jobs: { ...searchJobs, ...pageJobs, ...answerJobs },
}
