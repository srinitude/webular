import { mainEntity } from './search-hop.ts'

// Nested question: "the capital city of the country that hosted the 2016
// Summer Olympics" asks the outer fact of the country the inner clause names.
// Search snippets rarely name it, so the bridge comes from the fetched pages:
// a sentence holding the clause's years (else its entity) and a country. A
// country right before the clause verb ("Spain ... won") wins over one after
// it ("was won by New Zealand"); else the first such sentence's country.
// The outer question is then asked anew ("What is the capital city of Brazil?").
// ponytail: country clauses only, names from Intl region codes; add kinds when a miss needs one.
const NESTED = /\bthe\s+(?:country|nation)\s+(?:that|which|whose\s+\w+)\s+(\w+)\s+(.+?)\??$/i
const LETTERS = [...'ABCDEFGHIJKLMNOPRSTUVWYZ']
const NOT_COUNTRY = new Set(['AA', 'EU', 'EZ', 'UN', 'ZZ'])
const REGIONS = new Intl.DisplayNames(['en'], { type: 'region' })
const NAMES = LETTERS.flatMap((a) => LETTERS.map((b) => a + b))
  .filter((code) => !NOT_COUNTRY.has(code))
  .map((code) => REGIONS.of(code) ?? code)
  .filter((n) => /^[\p{L} ]+$/u.test(n) && !/^[A-Z]{2}$/.test(n))
  .sort((a, b) => b.length - a.length)
const COUNTRY = new RegExp(String.raw`\b(?:${NAMES.join('|')})\b`, 'u')

export const nestedBridge = (query: string, pages: ReadonlyArray<string>) => {
  const nested = query.match(NESTED)
  if (!nested) return undefined
  const [, verb = '', clause = ''] = nested
  const needs = clause.match(/\d+/g) ?? [mainEntity(clause) ?? clause]
  const said = pages
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .filter((s) => COUNTRY.test(s) && needs.every((n) => s.includes(n)))
  const subject = new RegExp(String.raw`^.*(${COUNTRY.source})[^.!?]*?\b${verb}\b`, 'u')
  const country =
    said.map((s) => s.match(subject)?.[1]).find(Boolean) ?? said[0]?.match(COUNTRY)?.[0]
  return country ? `${query.slice(0, nested.index)}${country}?` : undefined
}
