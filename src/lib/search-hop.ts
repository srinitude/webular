// Answer-mode second hop: when no top hit names the question's main entity,
// search the entity, then the fact with the entity page's title in place of
// the entity, and fuse both with the first round. One extra round, never
// recursive. The caller passes its own one-round search in, so this file
// never imports search-chain.ts.
import { Effect, Fiber } from 'effect'
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
// A run spans lowercase name connectors ("Bank of England") and drops quote
// marks around it, so a quoted title stays one entity. "in" joins only before
// "the" ("Love in the Time of Cholera"), so "Eiffel Tower in Paris" stays apart.
// ponytail: capitalization heuristic; swap in a Jev extractor if it misses.
const NOT_ENTITY = new Set(
  'Who What When Where Which Why How Is Was Were Are Did Does Do The A An In Of On At For'.split(
    ' ',
  ),
)
const WORD = String.raw`\p{Lu}[\p{L}\p{M}]*(?:['’-][\p{L}\p{M}]+)*`
const CONNECTOR = String.raw`(?:\s+(?:of|the|in(?=\s+the\b)|de|von|van|der|del|da|du|la|le))*`
const ENTITY_RUN = new RegExp(String.raw`${WORD}(?:${CONNECTOR}\s+${WORD})*`, 'gu')
export const mainEntity = (question: string): string | undefined =>
  (question.match(ENTITY_RUN) ?? [])
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

// An entity page's title ends in the entity's name, with at most three words
// before it ("Werner Heisenberg", "One Hundred Years of Solitude").
const namedFor = (entity: string) => (h: Hit) =>
  h.title.split(/\s+/).length <= entity.split(/\s+/).length + 3 &&
  h.title.toLowerCase().endsWith(entity.toLowerCase())

// The page titled exactly the entity wins over a longer namesake the ranking
// put higher ("Cookie Love in the Time of Cholera", a blog post).
const entityPage = (entity: string, hits: ReadonlyArray<Hit>) =>
  hits.find((h) => h.title.toLowerCase() === entity.toLowerCase()) ?? hits.find(namedFor(entity))

// The fact round searches the query with the entity page's title in place of
// the entity. That title is most often the entity itself, so the unchanged
// query starts beside the entity round; a renamed query drops it and runs anew.
const factRound = <M extends { weak: boolean }>(
  query: string,
  renamed: string,
  limit: number,
  early: Fiber.Fiber<Found<M>>,
  search: SearchRound<M>,
) =>
  renamed === query
    ? Fiber.join(early)
    : Effect.andThen(Fiber.interrupt(early), search(renamed, limit))

// Hop-only hits count at this share of their rank score: a tie goes to the
// original query's hit, yet a hop's first hit still beats the original's second.
const HOP_WEIGHT = 0.99
const key = (h: Hit) => hitKey(h.url)
// `lead` first, then the fused hits; the original's top hit survives the cut.
const finish = <M extends { weak: boolean }>(
  query: string,
  limit: number,
  first: Found<M>,
  hops: Hit[][],
  lead: Hit[],
) => {
  const base = new Map(scoreHits([first.results], query).map((e) => [key(e.hit), e.score]))
  const scored = scoreHits([first.results, ...hops], query)
    .map(({ hit, score }) => {
      const b = base.get(key(hit)) ?? 0
      return { hit, score: b + HOP_WEIGHT * (score - b) }
    })
    .sort((x, y) => y.score - x.score)
  const led = new Set(lead.map(key))
  const top = [...lead, ...scored.map((e) => e.hit).filter((h) => !led.has(key(h)))]
  const kept = top.slice(0, limit)
  const best = first.results[0]
  const lost = best && limit > lead.length && !kept.some((h) => key(h) === key(best))
  return {
    results: lost ? [...kept.slice(0, limit - 1), best] : kept,
    meta: { ...first.meta, weak: !lead.length && (scored[0]?.score ?? 0) < WEAK_SCORE },
  }
}

// Comparison ("Who is older, A or B?", "A vs B"): one sub-query per entity, the
// question with the other entity cut out. Capitalized names only.
const NAME = String.raw`(?!(?:${[...NOT_ENTITY].join('|')})\b)${WORD}(?:${CONNECTOR}\s+${WORD})*`
const COMPARE = new RegExp(String.raw`(${NAME})\s+(?:vs\.?|versus|or)\s+(${NAME})`, 'u')
export const comparisonParts = (query: string) => {
  const m = query.match(COMPARE)
  return m ? [m[1] ?? '', m[2] ?? ''].map((e) => query.replace(m[0], e)) : undefined
}

const compareHop = <M extends { weak: boolean }>(
  query: string,
  limit: number,
  first: Found<M>,
  parts: ReadonlyArray<string>,
  search: SearchRound<M>,
) =>
  Effect.map(
    Effect.all(
      parts.map((p) => search(p, limit)),
      { concurrency: 2 },
    ),
    (subs) =>
      finish(
        query,
        limit,
        first,
        subs.map((s) => s.results),
        [],
      ),
  )

// Runs only when the first round is weak: no top-3 hit names the entity.
// Scoped, so a fact round still in flight stops when the hop ends or times out.
export const secondHop = Effect.fn('secondHop')(function* <M extends { weak: boolean }>(
  query: string,
  limit: number,
  first: Found<M>,
  search: SearchRound<M>,
) {
  const parts = comparisonParts(query)
  if (parts) return yield* compareHop(query, limit, first, parts, search)
  const entity = mainEntity(query) ?? bridgeEntity(first.results.slice(0, HOP_TOP))
  if (!entity) return first
  // The entity page is already near the top: lead with it, since the answer
  // step takes the lead hit's title as the entity of a nameless question.
  const here = first.results.slice(0, HOP_TOP).find(namedFor(entity))
  if (here) return { ...first, results: [here, ...first.results.filter((h) => h !== here)] }
  // A bridge entity is not in the question, so its page is the fact source.
  const early = query.includes(entity) ? yield* Effect.forkScoped(search(query, limit)) : undefined
  const page = yield* search(entity, HOP_PAGE_LIMIT)
  const pageHit = entityPage(entity, page.results)
  const renamed = query.replace(entity, pageHit?.title ?? entity)
  const fact = early
    ? yield* factRound(query, renamed, limit, early, search)
    : { results: [] as Hit[] }
  // A hop that finds nothing new ends here: the first round stands.
  const known = new Set(first.results.map((h) => hitKey(h.url)))
  if (!pageHit && fact.results.every((h) => known.has(hitKey(h.url)))) return first
  // The entity page leads: the domain signal would sink a Wikipedia bio.
  return finish(query, limit, first, [fact.results], pageHit ? [pageHit] : [])
}, Effect.scoped)
