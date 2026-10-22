// FOSS CSS-selector helpers built on linkedom (open source). A field whose
// selector matches once is read directly; zero or several matches, or no
// selector, go to a Jev pick (decisions/extract.ts) with the code rule as fallback.
import { Data, Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { dropHidden } from './html-sanitize.ts'
import { JEV_CONCURRENCY } from './jev/client.ts'
import { type Candidate, fieldDecision, recoverDecision } from './jev/decisions/extract.ts'
import { onJevRuntime } from './jev/run.ts'
import { jsonLdNodes } from './json-ld.ts'

interface FieldSpec {
  name: string
  selector: string
}

export class InvalidFieldSpecError extends Data.TaggedError('InvalidFieldSpecError')<{
  message: string
}> {}

// "name:selector" or a bare "name"; a bare name has selector '' and Jev finds it.
export function parseFieldSpecs(raw: string): Effect.Effect<FieldSpec[], InvalidFieldSpecError> {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return Effect.forEach(
    parts,
    (part) => {
      const colon = part.indexOf(':')
      if (colon === 0) {
        return Effect.fail(
          new InvalidFieldSpecError({
            message: `invalid field spec "${part}" — expected "name[:selector]"`,
          }),
        )
      }
      if (colon < 0) return Effect.succeed({ name: part, selector: '' })
      return Effect.succeed({
        name: part.slice(0, colon).trim(),
        selector: part.slice(colon + 1).trim(),
      })
    },
    { concurrency: 1 },
  )
}

// Script, style, and hidden text never reach a field: a matched element's
// textContent would otherwise carry them.
const parseVisible = (html: string) => {
  const { document } = parseHTML(html)
  if (document.documentElement) dropHidden(document.documentElement)
  return document
}

const MAX_CANDIDATES = 60 // ponytail: first 60 text elements; rank by hint if pages run longer
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
// Source line breaks and indents are layout, not data: runs of white space read as one space.
const textOf = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const hintOf = (el: Element) =>
  ['id', 'class', 'itemprop', 'name', 'aria-label']
    .map((a) => el.getAttribute(a))
    .filter(Boolean)
    .join(' ')
const candidatesOf = (els: ReadonlyArray<Element>, leafOnly: boolean): Candidate[] =>
  els
    .filter((el) => !SKIP.has(el.tagName) && (!leafOnly || el.children.length === 0) && textOf(el))
    .slice(0, MAX_CANDIDATES)
    .map((el) => ({ tag: el.tagName.toLowerCase(), hint: hintOf(el), text: textOf(el) }))

// Structured data first (Web Data Commons, Mühleisen and Bizer, LDOW 2012):
// a bare field name that names a schema.org microdata, JSON-LD, or meta
// property takes its value before any text guess. Keys fold case and drop
// punctuation, so prep_time finds prepTime; the first source to name a key wins.
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const MAX_LD_DEPTH = 4
type Known = Map<string, string>
const ldValue = (v: unknown): string | undefined => {
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim() || undefined
  if (Array.isArray(v)) return ldValue(v[0])
  return v && typeof v === 'object' ? ldValue((v as Record<string, unknown>)['name']) : undefined
}
const addLd = (known: Known, node: Record<string, unknown>, depth: number): void => {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('@')) continue
    const value = ldValue(v)
    if (value && !known.has(keyOf(k))) known.set(keyOf(k), value)
    const nested = Array.isArray(v) ? v[0] : v
    if (depth < MAX_LD_DEPTH && nested && typeof nested === 'object')
      addLd(known, nested as Record<string, unknown>, depth + 1)
  }
}
const microValue = (el: Element) =>
  ['content', 'href', 'src', 'datetime'].map((a) => el.getAttribute(a)).find(Boolean) ?? textOf(el)
const structuredValues = (document: ReturnType<typeof parseHTML>['document']): Known => {
  const known: Known = new Map()
  const add = (key: string, value: string | null | undefined) => {
    const k = keyOf(key)
    if (k && value?.trim() && !known.has(k)) known.set(k, value.trim())
  }
  for (const el of Array.from(document.querySelectorAll('[itemprop]')))
    for (const prop of (el.getAttribute('itemprop') ?? '').split(/\s+/)) add(prop, microValue(el))
  for (const node of jsonLdNodes(document)) addLd(known, node, 0)
  for (const el of Array.from(document.querySelectorAll('meta[content]'))) {
    const key = el.getAttribute('property') ?? el.getAttribute('name') ?? ''
    add(key.slice(key.lastIndexOf(':') + 1), el.getAttribute('content'))
  }
  return known
}

const pickField = (
  document: ReturnType<typeof parseHTML>['document'],
  { name, selector }: FieldSpec,
  known: Known,
) => {
  const structured = selector ? undefined : known.get(keyOf(name))
  if (structured) return Effect.succeed(structured)
  const matched: Element[] = selector ? Array.from(document.querySelectorAll(selector)) : []
  if (matched.length === 1 && matched[0]) return Effect.succeed(textOf(matched[0]))
  const candidates =
    matched.length > 1
      ? candidatesOf(matched, false)
      : candidatesOf(Array.from(document.querySelectorAll('body *')), true)
  if (candidates.length === 0) return Effect.succeed('')
  return selector
    ? onJevRuntime(recoverDecision, { name, selector, matched: matched.length > 1, candidates })
    : onJevRuntime(fieldDecision, { name, candidates })
}

export const selectFields = (html: string, fields: ReadonlyArray<FieldSpec>) => {
  const { document } = parseHTML(html)
  // Read before dropHidden: meta tags and JSON-LD scripts are never rendered.
  const known: Known = fields.some((f) => !f.selector) ? structuredValues(document) : new Map()
  if (document.documentElement) dropHidden(document.documentElement)
  return Effect.forEach(fields, (f) => pickField(document, f, known), {
    concurrency: JEV_CONCURRENCY,
  }).pipe(
    Effect.map((values) => Object.fromEntries(fields.map((f, i) => [f.name, values[i] ?? '']))),
  )
}

export function selectMatches(html: string, selector: string): string[] {
  return Array.from(parseVisible(html).querySelectorAll(selector)).map(textOf).filter(Boolean)
}
