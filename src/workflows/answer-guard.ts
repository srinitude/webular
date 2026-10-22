// Answer guard: deterministic checks on the finished answer, no model call.
// - fetchedOnly: a cited URL must be a page that was fetched (arXiv 2604.03173).
// - withBareLead: a year or count question opens with the one bare figure (2605.04665).
// - conflictNote: cited sources whose answer sentences give different figures
//   get a one-line note (2608.22228).
import { answerPassage } from '../lib/answer-passage.ts'
import { findConflicts } from './research-report.ts'

interface Src {
  readonly url: string
  readonly text: string
}

export const fetchedOnly = <T extends { readonly url: string }>(
  cited: ReadonlyArray<T>,
  used: ReadonlyArray<{ readonly url: string }>,
): T[] => cited.filter((c) => used.some((u) => u.url === c.url))

const figures = (s: string) => (s.match(/\d[\d,.]*\d|\d/g) ?? []).map((f) => f.replace(/[,.]$/, ''))

const YEAR_QUESTION = /^\s*(what year|in what year)\b/i
const COUNT_QUESTION = /^\s*how (many|much)\b/i
// Only a lead holding exactly one matching figure (a 4-digit year for a year
// question) gets a bare opening: no guess.
export const withBareLead = (query: string, lead: string) => {
  const fs = YEAR_QUESTION.test(query)
    ? (lead.match(/\b\d{4}\b/g) ?? [])
    : COUNT_QUESTION.test(query)
      ? figures(lead)
      : []
  return fs.length === 1 ? `${fs[0]}. ${lead}` : lead
}

// Each cited source's best answer sentence; research-report's findConflicts
// flags two that share their words but not their numbers.
export const conflictNote = (query: string, cited: ReadonlyArray<Src>) => {
  const [c] = findConflicts(cited.map((s) => answerPassage([s.text], 1, { query })))
  return c === undefined
    ? ''
    : `Sources disagree: ${cited[c.sourceA]?.url} gives ${figures(c.sentenceA).join(', ')}; ${cited[c.sourceB]?.url} gives ${figures(c.sentenceB).join(', ')}.`
}

// The answer body led by its bare figure, with a note when the cited sources disagree.
export const finishAnswer = (query: string, cited: ReadonlyArray<Src>, body: string) =>
  [withBareLead(query, body), conflictNote(query, cited)].filter(Boolean).join(' ')
