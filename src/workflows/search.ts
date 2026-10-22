// SEARCH workflow: the default web source asks the free APIs that fit the
// query at once and fuses their lists, with scraped DuckDuckGo HTML as the
// fallback and the free sources after it (`source` names the one that
// answered); --source wikipedia|hackernews|arxiv|crossref|openalex|npm asks
// just that source. `meta` gives each source's status and ms plus
// degraded/weak. Local index hits fuse in after web hits.
// composed as a Mastra non-model workflow over the FOSS search lib.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { dropPrivateHosts, fuseRanked, searchLocalIndex } from '../lib/local-index.ts'
import { searchEffect } from '../lib/search-chain.ts'
import { searchErrors } from '../lib/search-errors.ts'
import { MAX_VARIANTS } from '../lib/search-source-names.ts'
import { creatorProducts } from '../lib/sources/creator-products.ts'
import { isNavigational } from '../lib/sources/official-sites.ts'
import { FREE_SOURCE_NAMES } from '../lib/sources/registry.ts'
import { SEARCH_SOURCES } from '../lib/sources-search.ts'
import { stepRuntime } from './runtime.ts'

const searchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
  source: z.enum(SEARCH_SOURCES).default('web'),
  variants: z.array(z.string().min(1)).max(MAX_VARIANTS).optional(),
})

const resultItem = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
})

const searchOutput = z.object({
  query: z.string(),
  count: z.number(),
  source: z.enum([...SEARCH_SOURCES, ...FREE_SOURCE_NAMES]).optional(),
  results: z.array(resultItem),
  meta: z.object({
    sources: z.record(z.string(), z.object({ status: z.string(), ms: z.number() })),
    degraded: z.boolean(),
    weak: z.boolean(),
  }),
  // Only when nothing was found because the sources failed: one {url, reason}
  // per failed source, and the command exits 1.
  errors: z.array(z.object({ url: z.string(), reason: z.string() })).optional(),
})

const searchStep = createStep({
  id: 'search',
  inputSchema: searchInput,
  outputSchema: searchOutput,
  execute: ({ inputData: { query, limit, source, variants }, abortSignal }) =>
    stepRuntime.runPromise(
      Effect.gen(function* () {
        // A product named only by its maker comes from Wikidata, beside the web round;
        // a navigational query asks in the official-site lookup's call instead.
        const [web, made] = yield* Effect.all(
          [
            searchEffect(source, query, limit, { variants: variants ?? [] }),
            source === 'web' && !isNavigational(query)
              ? creatorProducts(query, limit)
              : Effect.succeed([]),
          ],
          { concurrency: 2 },
        )
        // Local BM25 hits answer alongside the free APIs: one SQLite query, a few ms.
        const local = yield* searchLocalIndex(query, limit)
        const fused = yield* dropPrivateHosts(query, fuseRanked([made, web.results, local]))
        const results = fused.slice(0, limit)
        const answered = web.source && { source: web.source }
        // A source that answered "no results" worked; only an all-failed run is an error.
        const statuses = Object.values(web.meta.sources).map((s) => s.status)
        const allFailed = !statuses.some((s) => s === 'ok' || s === 'no-results')
        const errors = allFailed ? searchErrors({ results, meta: web.meta }) : []
        const failed = errors.length > 0 && { errors }
        return { query, count: results.length, ...answered, results, meta: web.meta, ...failed }
      }),
      { signal: abortSignal },
    ),
})

export const searchWorkflow = createWorkflow({
  id: 'search',
  inputSchema: searchInput,
  outputSchema: searchOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(searchStep)
  .commit()
