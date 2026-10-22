// FOSS CSS-selector helpers built on linkedom (open source). A field whose
// selector matches once is read directly; zero or several matches, or no
// selector, go to a Jev pick (decisions/extract.ts) with the code rule as fallback.
import { Data, Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { dropHidden } from './html-sanitize.ts'
import { JEV_CONCURRENCY } from './jev/client.ts'
import { type Candidate, fieldDecision, recoverDecision } from './jev/decisions/extract.ts'
import { onJevRuntime } from './jev/run.ts'
import { parseVisible, SKIP, textOf } from './select-dom.ts'
import { repeatedRecordSelector } from './select-record.ts'
import { type Known, keyOf, structuredOf, structuredValues } from './select-structured.ts'

export { repeatedRecordSelector }

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

const MAX_CANDIDATES = 60 // ponytail: first 60 text elements; rank by hint if pages run longer
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

export function selectMatches(html: string, selector: string): string[] {
  return Array.from(parseVisible(html).querySelectorAll(selector)).map(textOf).filter(Boolean)
}
