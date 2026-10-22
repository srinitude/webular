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

// Everyday names for the schema.org and og: keys that hold them.
const ALIASES: Record<string, string[]> = {
  date: ['datepublished', 'publishedtime', 'datecreated', 'datemodified'],
  offer: ['price'],
}
const structuredOf = (known: Known, name: string) =>
  [keyOf(name), ...(ALIASES[keyOf(name)] ?? [])].map((k) => known.get(k)).find(Boolean)

// Model-free locator ladder: a rung answers only on exactly one match.
const ladderOf = (document: ReturnType<typeof parseHTML>['document'], name: string) => {
  const quoted = name.replace(/["\\]/g, '\\$&')
  for (const attr of ['role', 'data-testid', 'aria-label']) {
    const hits = document.querySelectorAll(`[${attr}="${quoted}"]`)
    const text = hits.length === 1 && hits[0] ? textOf(hits[0]) : ''
    if (text) return text
  }
  const want = name.toLowerCase()
  const labels = Array.from(document.querySelectorAll('body *')).filter(
    (el) => el.children.length === 0 && textOf(el).toLowerCase().replace(/:$/, '') === want,
  )
  const next = labels.length === 1 ? labels[0]?.nextElementSibling : null
  return next ? textOf(next) : ''
}

const pickField = (
  document: ReturnType<typeof parseHTML>['document'],
  { name, selector }: FieldSpec,
  known: Known,
  pageTitle: string,
) => {
  const structured = selector ? undefined : structuredOf(known, name)
  if (structured) return Effect.succeed(structured)
  const located = selector ? '' : ladderOf(document, name)
  if (located) return Effect.succeed(located)
  const matched: Element[] = selector ? Array.from(document.querySelectorAll(selector)) : []
  if (matched.length === 1 && matched[0]) return Effect.succeed(textOf(matched[0]))
  // A selector the page no longer matches falls back to the page metadata of that
  // name (a "title" field to <title>) before any guess from body text.
  const meta =
    selector && matched.length === 0
      ? (structuredOf(known, name) ?? (keyOf(name) === 'title' ? pageTitle : ''))
      : ''
  if (meta) return Effect.succeed(meta)
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
  const known = structuredValues(document)
  const pageTitle = document.title?.trim() ?? ''
  if (document.documentElement) dropHidden(document.documentElement)
  return Effect.forEach(fields, (f) => pickField(document, f, known, pageTitle), {
    concurrency: JEV_CONCURRENCY,
  }).pipe(
    Effect.map((values) => Object.fromEntries(fields.map((f, i) => [f.name, values[i] ?? '']))),
  )
}

// Listing pages repeat one record shape under one parent: the biggest run of
// same tag-and-class siblings becomes one selector (unique parent path + shape).
const shapeOf = (el: Element) =>
  el.tagName.toLowerCase() +
  Array.from(el.classList)
    .filter((c) => /^[\w-]+$/.test(c))
    .map((c) => `.${c}`)
    .join('')
const pathOf = (el: Element): string => {
  const parent = el.parentElement
  if (!parent || el.tagName === 'BODY') return 'body'
  const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName)
  const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : ''
  return `${pathOf(parent)} > ${el.tagName.toLowerCase()}${nth}`
}
// ponytail: tag and class equality only; match on attribute shape if sites vary class per row.
export function repeatedRecordSelector(html: string): string | undefined {
  let best: { n: number; selector: string } | undefined
  for (const parent of Array.from(parseVisible(html).querySelectorAll('body, body *'))) {
    const counts = new Map<string, number>()
    for (const c of Array.from(parent.children))
      if (!SKIP.has(c.tagName) && textOf(c))
        counts.set(shapeOf(c), (counts.get(shapeOf(c)) ?? 0) + 1)
    for (const [shape, n] of counts)
      if (n >= 3 && n > (best?.n ?? 0)) best = { n, selector: `${pathOf(parent)} > ${shape}` }
  }
  return best?.selector
}

export function selectMatches(html: string, selector: string): string[] {
  return Array.from(parseVisible(html).querySelectorAll(selector)).map(textOf).filter(Boolean)
}
