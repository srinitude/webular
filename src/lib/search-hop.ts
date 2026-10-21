// Answer-mode second hop: when no top hit names the question's main entity,
// search the entity, then the fact with the entity page's title in place of
// the entity, and fuse both with the first round. One extra round, never
// recursive. The caller passes its own one-round search in, so this file
// never imports search-chain.ts.
import { Effect } from 'effect'
import { hitKey, scoreHits, WEAK_SCORE } from './search.ts'

interface Hit {
  title: string
  url: string
  description: string
}
interface Found<M extends { weak: boolean }> {
  results: Hit[]
  meta: M
}
type SearchRound<M extends { weak: boolean }> = (
  query: string,
  limit: number,
) => Effect.Effect<Found<M>>

// Main entity of a question: the longest run of capitalized words, minus
// question and function words ("Where was Heisenberg born?" -> "Heisenberg").
// ponytail: capitalization heuristic; swap in a Jev extractor if it misses.
const NOT_ENTITY = new Set(
  'Who What When Where Which Why How Is Was Were Are Did Does Do The A An In Of On At For'.split(
    ' ',
  ),
)
export const mainEntity = (question: string): string | undefined =>
  (question.match(/\p{Lu}[\p{L}\p{M}'-]*(?:\s+\p{Lu}[\p{L}\p{M}'-]*)*/gu) ?? [])
    .map((run) =>
      run
        .split(/\s+/)
        .filter((w) => !NOT_ENTITY.has(w))
        .join(' '),
    )
    .reduce<string | undefined>(
      (best, e) => (e && e.length > (best?.length ?? 0) ? e : best),
      undefined,
    )

const HOP_TOP = 3
// The domain signal ranks a Wikipedia bio low, so the entity round looks deeper.
const HOP_PAGE_LIMIT = 10

// No name in the question: take the owner the top snippets name most often
// ("Heisenberg's uncertainty principle" -> "Heisenberg").
const POSSESSIVE = /(\p{Lu}[\p{L}-]+)['’]s\b/gu
const bridgeEntity = (hits: ReadonlyArray<Hit>): string | undefined => {
  const counts = new Map<string, number>()
  for (const h of hits)
    for (const [, name = ''] of h.description.matchAll(POSSESSIVE))
      counts.set(name, (counts.get(name) ?? 0) + 1)
  let best: [string, number] | undefined
  for (const e of counts) if (!best || e[1] > best[1]) best = e
  return best?.[0]
}

// Runs only when the first round is weak: no top-3 hit names the entity.
export const secondHop = Effect.fn('secondHop')(function* <M extends { weak: boolean }>(
  query: string,
  limit: number,
  first: Found<M>,
  search: SearchRound<M>,
) {
  const entity = mainEntity(query) ?? bridgeEntity(first.results.slice(0, HOP_TOP))
  // An entity page has a short title ending in its name ("Werner Heisenberg").
  const named = (h: Hit) =>
    h.title.split(/\s+/).length <= 4 && h.title.toLowerCase().endsWith(entity?.toLowerCase() ?? '')
  if (!entity) return first
  // The entity page is already near the top: lead with it, since the answer
  // step takes the lead hit's title as the entity of a nameless question.
  const here = first.results.slice(0, HOP_TOP).find(named)
  if (here) return { ...first, results: [here, ...first.results.filter((h) => h !== here)] }
  const page = yield* search(entity, HOP_PAGE_LIMIT)
  const name = page.results.find(named)?.title ?? entity
  // A bridge entity is not in the question, so its page is the fact source.
  const fact = query.includes(entity)
    ? yield* search(query.replace(entity, name), limit)
    : { results: [] as Hit[] }
  // The entity page leads: the domain signal would sink a Wikipedia bio.
  const lead = page.results.filter(named).slice(0, 1)
  const leadKeys = new Set(lead.map((h) => hitKey(h.url)))
  const scored = scoreHits([fact.results, first.results], query)
  const rest = scored.map((e) => e.hit).filter((h) => !leadKeys.has(hitKey(h.url)))
  return {
    results: [...lead, ...rest].slice(0, limit),
    meta: { ...first.meta, weak: !lead.length && (scored[0]?.score ?? 0) < WEAK_SCORE },
  }
})
