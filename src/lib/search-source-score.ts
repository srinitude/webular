// Which search source to trust and how much its list counts in fusion.
//  - Type first (arXiv 2607.03028): every source belongs to one class, and the
//    class sets the fusion weight.
//  - Observed score (arXiv 2605.14241): hit rate over (1 + latency / 1500 ms),
//    both as exponential moving averages, kept in a Ref inside a layer.
//  - Class weights (arXiv 2610.24341, 2503.20698, 2609.18248): constants in a
//    weighted reciprocal rank fusion.
import { Context, Effect, Layer, Ref } from 'effect'
import type { SearchSource } from './search-source-names.ts'
import type { SourceStatus } from './search-source-run.ts'

type SourceClass = 'web' | 'encyclopedia' | 'community' | 'scholarly' | 'package' | 'code'

const CLASS_OF: Record<SearchSource, SourceClass> = {
  web: 'web',
  marginalia: 'web',
  wikipedia: 'encyclopedia',
  hackernews: 'community',
  arxiv: 'scholarly',
  crossref: 'scholarly',
  openalex: 'scholarly',
  npm: 'package',
  'github-search': 'code',
}
export const classOf = (source: SearchSource): SourceClass => CLASS_OF[source]

// ponytail: hand-set constants, unmeasured; tune them from a bench run, not by feel.
// Scaled so the top weight is 1, the weight official sites and the local index get.
export const CLASS_WEIGHT: Record<SourceClass, number> = {
  web: 5 / 6,
  encyclopedia: 1,
  scholarly: 5 / 6,
  community: 2 / 3,
  package: 2 / 3,
  code: 2 / 3,
}

// One class weight per list a source run returned, for scoreHits in search.ts;
// official sites and the local index have no class and stay at weight 1.
export const listWeights = (r: { source: SearchSource; lists: ReadonlyArray<unknown> }) =>
  r.lists.map(() => CLASS_WEIGHT[classOf(r.source)])

// Same k as the fusion in search.ts.
const RRF_K = 60
// `rank0` is the zero-based place in the source's own list.
export const weightedRrf = (source: SearchSource, rank0: number) =>
  CLASS_WEIGHT[classOf(source)] / (RRF_K + rank0 + 1)

const LATENCY_SCALE_MS = 1500
export const sourceScore = (hitRate: number, latencyMs: number) =>
  hitRate / (1 + latencyMs / LATENCY_SCALE_MS)

const ALPHA = 0.3
const PRIOR = { hitRate: 0.5, latencyMs: LATENCY_SCALE_MS }
type Stat = typeof PRIOR
const ema = (old: number, sample: number) => old + ALPHA * (sample - old)

const makeStats = Effect.gen(function* () {
  const stats = yield* Ref.make<ReadonlyMap<SearchSource, Stat>>(new Map())
  const record = (source: SearchSource, status: SourceStatus, ms: number) =>
    Ref.update(stats, (m) => {
      const old = m.get(source) ?? PRIOR
      return new Map(m).set(source, {
        hitRate: ema(old.hitRate, status === 'ok' ? 1 : 0),
        latencyMs: ema(old.latencyMs, ms),
      })
    })
  // Stable: ties keep the caller's order.
  const rank = (sources: ReadonlyArray<SearchSource>) =>
    Effect.map(Ref.get(stats), (m) => {
      const score = (s: SearchSource) => {
        const { hitRate, latencyMs } = m.get(s) ?? PRIOR
        return sourceScore(hitRate, latencyMs)
      }
      return sources.toSorted((a, b) => score(b) - score(a))
    })
  return { record, rank }
})

export class SourceStats extends Context.Service<
  SourceStats,
  {
    readonly record: (s: SearchSource, status: SourceStatus, ms: number) => Effect.Effect<void>
    readonly rank: (sources: ReadonlyArray<SearchSource>) => Effect.Effect<SearchSource[]>
  }
>()('webular/lib/SourceStats') {
  static readonly layer = Layer.effect(SourceStats, makeStats)
}
