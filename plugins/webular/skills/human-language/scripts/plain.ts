// The human-language skill's word rules as code: one source for the Jev
// payload pass (plainText) and the readability lint (proseIssues).
// Code spans in backticks are never touched or judged, so exact names stay.
import words from './words.json' with { type: 'json' }

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const phrase = (s: string, flags = 'gi') =>
  new RegExp(`\\b${escapeRegExp(s).replace(/ /g, '\\s+')}\\b`, flags)
const swaps = words.swaps.map(([from = '', to = '']) => [phrase(from), to] as const)
const cuts = words.cut.map((word) => [word, phrase(word, 'i')] as const)

// Odd pieces are backtick spans; even pieces are prose.
const pieces = (text: string) => text.split(/(`[^`]*`)/)
const prose = (text: string) => pieces(text).filter((_, i) => i % 2 === 0)

const swap = (text: string) =>
  swaps.reduce(
    (t, [re, word]) =>
      t.replace(re, (m) =>
        /^[A-Z]/.test(m) ? word.charAt(0).toUpperCase() + word.slice(1) : word,
      ),
    text.replace(/\s+/g, ' '),
  )

export const plainText = (text: string) =>
  pieces(text)
    .map((part, i) => (i % 2 ? part : swap(part)))
    .join('')
    .trim()

// Rule breaks in one string: filler to swap, words to cut, sentences over the
// word limit, and exact names the text must carry (for example `input`).
export const proseIssues = (text: string, names: ReadonlyArray<string> = []) => {
  const plain = prose(text).join(' ')
  const issues: Array<string> = []
  for (const [re] of swaps) {
    const hit = plain.match(re)?.[0]
    if (hit) issues.push(`filler: ${hit}`)
  }
  for (const [word, re] of cuts) if (re.test(plain)) issues.push(`cut: ${word}`)
  for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
    const count = sentence.split(/\s+/).filter(Boolean).length
    if (count > words.maxSentenceWords) issues.push(`long sentence: ${count} words`)
  }
  for (const name of names) if (!text.includes(name)) issues.push(`missing name: ${name}`)
  return issues
}
