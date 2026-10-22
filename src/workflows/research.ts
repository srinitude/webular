// RESEARCH workflow: search DDG HTML → fetch top N → extract + summarize → markdown report
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect, Ref } from 'effect'
import { z } from 'zod'
import { mdHeading } from '../core/output.ts'
import { pageImageSchema } from '../lib/answer-figure.ts'
import { searchRounds } from '../lib/jev/decisions/research.ts'
import { researchSentences } from '../lib/jev/decisions/research-sentences.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { onJevRuntime } from '../lib/jev/run.ts'
import { readabilitySchema, withReadability } from '../lib/readability-chain.ts'
import { sourceFigures } from '../lib/router-images.ts'
import { searchEffect } from '../lib/search-chain.ts'
import { searchErrors } from '../lib/search-errors.ts'
import { fetchErrorsSchema, fetchSources, type SourceEntry } from '../lib/sources.ts'
import { stepRuntime } from './runtime.ts'

const researchInput = z.object({
  topic: z.string().min(1),
  depth: z.number().int().min(1).max(10).default(3),
  sentences: z.number().int().min(1).max(25).default(2),
  timeoutMs: z.number().int().positive().optional(),
})

const sourceItem = z.object({ title: z.string(), url: z.string() })

const researchOutput = z.object({
  topic: z.string(),
  report: z.string(),
  sources: z.array(sourceItem),
  errors: fetchErrorsSchema,
  readability: readabilitySchema,
})

const foundSchema = z.object({
  topic: z.string(),
  sentences: z.number(),
  timeoutMs: z.number().optional(),
  sources: z.array(sourceItem),
  // Search sources that failed when no round found anything.
  errors: fetchErrorsSchema,
})

const entriesSchema = z.object({
  topic: z.string(),
  sentences: z.number(),
  entries: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      text: z.string(),
      images: z.array(pageImageSchema).optional(),
    }),
  ),
  errors: fetchErrorsSchema,
})

const searchStep = createStep({
  id: 'search',
  inputSchema: researchInput,
  outputSchema: foundSchema,
  // Bounded rounds: research.done asks for another search only when the hits miss the topic.
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(
      Effect.gen(function* () {
        const failures = yield* Ref.make(new Map<string, { url: string; reason: string }>())
        const found = yield* searchRounds(inputData.topic, inputData.depth, (q, n) =>
          searchEffect('web', q, n).pipe(
            Effect.tap((r) =>
              Ref.update(
                failures,
                (m) => new Map([...m, ...searchErrors(r).map((e) => [e.url, e] as const)]),
              ),
            ),
            Effect.map((r) => r.results),
          ),
        )
        return {
          topic: inputData.topic,
          sentences: inputData.sentences,
          timeoutMs: inputData.timeoutMs,
          sources: found.map((h) => ({ title: h.title, url: h.url })),
          errors: found.length === 0 ? [...(yield* Ref.get(failures)).values()] : [],
        }
      }),
      { signal: abortSignal },
    ),
})

// Keep only the fetched sources that hold facts on the topic (answer.sources); none with text skips the call.
const fetchAndFilter = Effect.fn('research.fetchSources')(function* (
  input: z.infer<typeof foundSchema>,
) {
  const fetched = yield* fetchSources(input.sources, input.timeoutMs)
  const withText = fetched.entries.filter((e) => e.text.length > 0)
  const entries =
    withText.length === 0
      ? withText
      : yield* onJevRuntime(decisions.answerSources, { question: input.topic, sources: withText })
  return {
    topic: input.topic,
    sentences: input.sentences,
    entries: [...entries],
    errors: [...input.errors, ...fetched.errors],
  }
})

const fetchSourcesStep = createStep({
  id: 'fetch-sources',
  inputSchema: foundSchema,
  outputSchema: entriesSchema,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(fetchAndFilter(inputData), { signal: abortSignal }),
})

// Each section opens with the sentences Jev keeps as the source's facts, in page
// order (research.sentences, one call per source); the topic-focused summarizer
// fills the rest, so sentences holding the topic's key terms rank first.
function buildSection(
  entry: SourceEntry,
  idx: number,
  topN: number,
  topic: string,
  kept: ReadonlyArray<number> = [],
  figures: ReadonlyArray<string> = [],
) {
  const all = researchSentences(entry.text)
  const top = researchSentences(entry.text, topN, topic)
  const lead = kept.flatMap((i) => (all[i] === undefined ? [] : [all[i]]))
  const sentences = [...new Set([...lead, ...top])].slice(0, topN)
  const body = sentences.length > 0 ? sentences.join(' ') : 'No extractable content.'
  const figs = figures.length > 0 ? `\n\n${figures.join('\n')}` : ''
  return `## ${mdHeading(entry.title) || `Source ${idx + 1}`}\n\n${body}${figs}\n\n> Source [${idx + 1}]: ${entry.url}`
}

// image.router per source: figures only where the answer sits in a picture.
const figuresOf = (topic: string, entries: ReadonlyArray<SourceEntry>) =>
  Effect.forEach(entries, (e) => onJevRuntime(sourceFigures, { question: topic, ...e }), {
    concurrency: 8,
  })

const assemble = Effect.fn('research.assemble')(function* (
  inputData: z.infer<typeof entriesSchema>,
) {
  const { topic, entries } = inputData
  const leads = yield* Effect.forEach(
    entries,
    (e) =>
      e.text.length === 0
        ? Effect.succeed(undefined)
        : onJevRuntime(decisions.researchSentence, { topic, text: e.text }),
    { concurrency: 8 }, // Jev per-org bound; workflows never import the client
  )
  const figures = yield* figuresOf(topic, entries)
  const sections = entries.map((e, i) =>
    buildSection(e, i, inputData.sentences, topic, leads[i], figures[i]),
  )
  const report = `# Research: ${topic}\n\n${sections.join('\n\n')}`
  const sources = entries.map((e) => ({ title: e.title, url: e.url }))
  return { topic, report, sources, errors: inputData.errors }
})

const assembleStep = createStep({
  id: 'assemble',
  inputSchema: entriesSchema,
  outputSchema: researchOutput,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(assemble(inputData).pipe(Effect.flatMap(withReadability('report'))), {
      signal: abortSignal,
    }),
})

export const researchWorkflow = createWorkflow({
  id: 'research',
  inputSchema: researchInput,
  outputSchema: researchOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(searchStep)
  .then(fetchSourcesStep)
  .then(assembleStep)
  .commit()
