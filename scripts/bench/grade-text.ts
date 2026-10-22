// Text helpers for deterministic answer grading: number grammar, answer
// extraction before alias match, hedge and shotgun-list detection.

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
// Digit groups of exactly three: "1,358,000", "1 358 000", "1'358'000".
const GROUPED = /(?<![\d.,])\d{1,3}(?:[,'    ]\d{3})+(?!\d)/g
// European dot grouping needs two or more groups, so "1.358" stays a decimal.
const DOT_GROUPED = /(?<![\d.])\d{1,3}(?:\.\d{3}){2,}(?!\d)/g
// "1.5 x 10^3", "2×10³", "3e-2".
const NUMBER =
  /(-?\d+(?:\.\d+)?)(?:\s*[x×*]\s*10\s*\^?\s*(-?[\d⁰¹²³⁴⁵⁶⁷⁸⁹]+)|[eE]([-+]?\d+)(?!\w))?/g

const exponent = (s: string): string =>
  s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPERSCRIPTS.indexOf(c)))

// Any Unicode decimal digit ("４", "٤", "४") becomes its ASCII digit. Each
// digit block is a run of tens starting at zero, so the value is the count of
// digits before it in its run, mod 10.
const asciiDigit = (d: string): string => {
  let cp = d.codePointAt(0) as number
  let k = 0
  while (/\p{Nd}/u.test(String.fromCodePoint(cp - 1))) [cp, k] = [cp - 1, k + 1]
  return String(k % 10)
}

export const numbersIn = (text: string): number[] =>
  [
    ...text
      .replace(/(?![0-9])\p{Nd}/gu, asciiDigit)
      .replace(/[−⁻]/g, '-')
      .replace(DOT_GROUPED, (g) => g.replaceAll('.', ''))
      .replace(GROUPED, (g) => g.replace(/\D/g, ''))
      .matchAll(NUMBER),
  ].map((m) => Number(`${m[1]}e${exponent(m[2] ?? m[3] ?? '0')}`))

// The last "Answer: X" / "Final answer - X" line, else the whole output.
const MARKED = /^[\s>#*_-]*(?:final\s+)?answer[*_\s]*[:\-–—][*_\s]*(.+?)[*_\s]*$/gim

export const answerCandidate = (output: string): string => {
  const marked = [...output.matchAll(MARKED)].at(-1)?.[1]
  return marked === undefined || marked === '' ? output : marked
}

// Only short candidates are judged for hedges and lists; a long
// explanation that ends in the right answer is verbose-correct.
const SHORT = 300
const HEDGE = /\b(?:might be|may be|perhaps|possibly|not sure|unsure|either .+ or)\b/i

export const isHedged = (text: string): boolean => text.length <= SHORT && HEDGE.test(text)

// ponytail: counts list-like segments; a sentence with many short clauses could
// trip it. Upgrade path: a Jev call once a decision-models receipt exists.
export const isShotgun = (text: string, goldSize: number): boolean => {
  if (text.length > SHORT) return false
  const items = text.split(/[,;\n]|\band\b|\bor\b/).filter((i) => i.trim() !== '')
  return items.length > goldSize + 4 && items.every((i) => i.trim().split(/\s+/).length <= 4)
}
