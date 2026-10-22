// Answer passage: the plain-rule sentences for an answer. Page chrome and
// reference lines drop out before scoring, the top entity page's lead
// sentence ("X is a 2024 novel by ...") comes first, and sentences that hold
// an answer of the asked type (a place for "where", a name for "who") lead.
import { splitQuestion, summarizeText } from './summarize.ts'

// Chrome glued into page text: archive stamps, the site tagline, "Retrieved"
// stamps, and quoted reference titles (`"ACM's Turing Award prize".`).
// ponytail: a closing quote before the period marks a reference title, so a
// prose sentence that ends on a quoted phrase in that style drops too.
const CHROME = [
  /Archived from the original(?: on [^.]*)?\.?/g,
  /From Wikipedia, the free encyclopedia/g,
  /Retrieved (?:on )?\d{1,2} \w+ \d{4}\.?/g,
  /Retrieved \w+ \d{1,2}, \d{4}\.?/g,
  /"?[^".\n]{0,200}"\.(?=\s|$)/g,
]
const stripChrome = (text: string) => CHROME.reduce((t, re) => t.replace(re, '\n'), text)

// A lead sentence defines the page's subject: "X (born ...) is a ...".
const LEAD =
  /(?:^|[.!?\n]\s*)([A-Z][^.!?\n]{0,300}?\b(?:is|was) (?:a|an|the)\b[^\n]*?[.!?])(?=\s|$)/
const leadSentence = (text: string) => LEAD.exec(text.slice(0, 4_000))?.[1]?.trim()

// Unicode letter classes, so "Würzburg" and "José Martí" count.
const NAME = /(?<!\p{L})\p{Lu}\p{Ll}+(?: \p{Lu}\.)? \p{Lu}\p{Ll}+(?!\p{L})/gu
const PLACE = /\b(?:born|in|from)\s+(?:\p{Lu}\p{Ll}+,?\s*)+/gu
const answerType = (query: string) =>
  /\bwhere\b|\bwhich (?:country|city|state)\b/i.test(query)
    ? PLACE
    : /\bwho\b/i.test(query)
      ? NAME
      : undefined
// The sentence names a person or place the question does not.
const holdsType = (sentence: string, re: RegExp, asked: Set<string>) =>
  [...sentence.matchAll(re)].some((m) =>
    m[0].split(/[\s,]+/).some((w) => /^\p{Lu}/u.test(w) && !asked.has(w.toLowerCase())),
  )

// A sentence ends on terminal punctuation, before any citation markers
// ("ft).[5]", "1843.[1][2]", or a split left dangling as "in).["). A heading
// line ("Kestrel Bridge") is no claim and would glue onto the next sentence.
const citations = /(?:\s*\[[^\]\s]{0,12}\]?)+$/u
export const isSentence = (s: string) => /[.!?]["')\]]?$/.test(s.trim().replace(citations, ''))

// Word stems, so "opened" matches "open" and "glows" matches "glow".
// ponytail: suffix strip, not a real stemmer; swap one in if recall needs it.
const stem = (w: string) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w)
const stems = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(stem)

// Rarer question terms weigh more within the pool (a year beats "award").
const termScore = (pool: ReadonlyArray<string>, asked: Set<string>) => {
  const sets = pool.map((s) => new Set(stems(s)))
  const df = (w: string) => sets.filter((set) => set.has(w)).length
  const weight = new Map([...asked].map((w) => [w, Math.log((pool.length + 1) / (df(w) + 1))]))
  return (i: number) => [...weight].reduce((t, [w, v]) => t + (sets[i]?.has(w) ? v : 0), 0)
}

interface Focus {
  query: string
  entity?: string | undefined
}
export function answerPassage(pages: ReadonlyArray<string>, n: number, focus: Focus): string[] {
  const clean = pages.map(stripChrome)
  const lead = clean[0] === undefined ? undefined : leadSentence(clean[0])
  const pool = summarizeText(clean.join('\n\n'), n * 3, focus).sentences.filter(isSentence)
  const asked = new Set(stems(focus.query))
  const re = answerType(focus.query)
  // Only the asked part weighs; a describing clause's rare words would win.
  const score = termScore(pool, new Set(stems(splitQuestion(focus.query).asked)))
  const typed = pool
    .map((s, i) => ({ s, k: score(i) }))
    .filter(({ s }) => re === undefined || holdsType(s, re, asked))
    .sort((a, b) => b.k - a.k)
    .map(({ s }) => s)
  const ranked = [...typed, ...pool.filter((s) => !typed.includes(s))]
  return [...new Set([...(lead === undefined ? [] : [lead]), ...ranked])].slice(0, n)
}
