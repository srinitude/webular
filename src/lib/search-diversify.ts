// Post-fusion cleanup of a scored hit list, all deterministic and in-memory:
// merge near copies and spread a redundant top over hosts. No hit is dropped:
// the graders read the top 5, and a single-source hit (often the official site)
// can score under a quarter of a hit that several sources return.
interface Hit {
  title: string
  url: string
  description: string
}

export interface Scored<H extends Hit> {
  hit: H
  score: number
  lists: number[] // indexes of the input lists that returned the hit
  rank: number // 1-based final position
  places?: Array<[list: number, rank: number]> // each list's 1-based rank for the hit
  signal?: number // the domain-signal term: > 0 official site, < 0 aggregator
}

type Entry<H extends Hit> = Omit<Scored<H>, 'rank'>

const COPY_JACCARD = 0.9 // snippets this alike are one text (arXiv 2607.17291)
const COPY_MIN_WORDS = 8 // shorter snippets say too little to compare
const TOP_K = 5 // the window that decides if the list is redundant

const host = (url: string) => URL.parse(url)?.hostname.replace(/^www\./, '') ?? url
const titleKey = (h: Hit) => h.title.toLowerCase().replace(/[^a-z0-9]+/g, '')
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? [])

function jaccard(a: Set<string>, b: Set<string>): number {
  let both = 0
  for (const w of a) if (b.has(w)) both++
  return both / (a.size + b.size - both)
}

// Same host and title, or near-identical long snippets on any host.
function isCopy(a: Hit, b: Hit): boolean {
  if (host(a.url) === host(b.url) && titleKey(a) !== '' && titleKey(a) === titleKey(b)) return true
  const [wa, wb] = [words(a.description), words(b.description)]
  return Math.min(wa.size, wb.size) >= COPY_MIN_WORDS && jaccard(wa, wb) >= COPY_JACCARD
}

const byScore = <H extends Hit>(a: Entry<H>, b: Entry<H>) => b.score - a.score

// The best-scored copy stays and takes the others' score and lists.
// ponytail: O(n^2) pairwise scan; fine for one page of ~30-100 hits, use a
// shingle index if lists grow far past that. Dates are not on hits, so
// "newest copy wins" is not applied: the best-scored copy wins.
function mergeCopies<H extends Hit>(entries: Entry<H>[]): Entry<H>[] {
  const kept: Entry<H>[] = []
  for (const e of [...entries].sort(byScore)) {
    const twin = kept.find((k) => isCopy(k.hit, e.hit))
    if (!twin) kept.push({ ...e, lists: [...e.lists], places: [...(e.places ?? [])] })
    else {
      twin.score += e.score
      twin.places = [...(twin.places ?? []), ...(e.places ?? [])]
      twin.lists = [...new Set([...twin.lists, ...e.lists])].sort((x, y) => x - y)
    }
  }
  return kept.sort(byScore)
}

// Redundant = one host holds more than half of the top window. Then the first
// hit of each host goes first (MMR with a host-match penalty), the rest follow
// in score order. A varied top is left alone (arXiv 2610.09412, 2604.13728, 2601.17212).
function diversify<H extends Hit>(entries: Entry<H>[]): Entry<H>[] {
  const top = entries.slice(0, TOP_K).map((e) => host(e.hit.url))
  const biggest = Math.max(0, ...top.map((h) => top.filter((x) => x === h).length))
  if (biggest * 2 <= top.length) return entries
  const seen = new Set<string>()
  const firsts: Entry<H>[] = []
  const rest: Entry<H>[] = []
  for (const e of entries) {
    const h = host(e.hit.url)
    if (seen.has(h)) rest.push(e)
    else {
      seen.add(h)
      firsts.push(e)
    }
  }
  return [...firsts, ...rest]
}

export const cleanHits = <H extends Hit>(entries: Entry<H>[]): Scored<H>[] =>
  diversify(mergeCopies(entries)).map((e, i) => ({ ...e, rank: i + 1 }))

// Rerank skip gate (retrieval-changes #4): when two or more lists agree on the top hit and it
// leads the next by at least one first-place RRF vote (1/61), BM25 would not move it; keep the
// fused order and skip the rerank.
const CLEAR_LEAD = 1 / 61
export const clearLead = <H extends Hit>(scored: ReadonlyArray<Scored<H>>): boolean => {
  const [top, next] = scored
  return !!top && top.lists.length >= 2 && top.score - (next?.score ?? 0) >= CLEAR_LEAD
}
