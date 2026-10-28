// The raw fused score of each returned search hit, with its terms and a word,
// for `search --why`. The words name a place in this run, never absolute
// relevance: `clear lead` is the top hit when clearLead holds (2+ lists agree
// and it leads the next by 1/61); `weak` is under WEAK_SCORE (one list's first
// place, nothing agreeing); `backed` is every other hit.
import { WEAK_SCORE } from './search.ts'
import { clearLead, type Scored } from './search-diversify.ts'

type ScoreWord = 'clear lead' | 'backed' | 'weak'

export const scoreWord = (score: number, leads: boolean): ScoreWord =>
  leads ? 'clear lead' : score < WEAK_SCORE ? 'weak' : 'backed'

// `brave#1` = brave's list ranked the hit first; `+official` / `-aggregator` =
// the domain-signal term.
interface HitScore {
  url: string
  score: number
  parts: string[]
  word: ScoreWord
}

type Entry = Pick<Scored<Hit>, 'places' | 'signal' | 'score'> & { hit: { url: string } }
interface Hit {
  title: string
  url: string
  description: string
}

const signed = (s: number | undefined) => (s ? [s > 0 ? '+official' : '-aggregator'] : [])

export const hitScore = (e: Entry, names: ReadonlyArray<string>, leads: boolean): HitScore => ({
  url: e.hit.url,
  score: e.score,
  parts: [...(e.places ?? []).map(([li, r]) => `${names[li] ?? 'list'}#${r}`), ...signed(e.signal)],
  word: scoreWord(e.score, leads),
})

// One HitScore per returned hit, in output order. Fused list i came from the
// i-th list of the source runs, then the local index; only the fused top can lead.
export const scoresOf = <H extends Hit>(
  results: ReadonlyArray<H>,
  scored: ReadonlyArray<Scored<H>>,
  ran: ReadonlyArray<{ source: string; lists: ReadonlyArray<unknown> }>,
): HitScore[] => {
  const names = [...ran.flatMap((r) => r.lists.map(() => r.source)), 'local']
  const lead = clearLead(scored)
  const byHit = new Map(scored.map((e) => [e.hit, e] as const))
  return results.flatMap((h) => {
    const e = byHit.get(h)
    return e ? [hitScore(e, names, lead && e === scored[0])] : []
  })
}
