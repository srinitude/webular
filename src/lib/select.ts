// FOSS CSS-selector helpers built on linkedom (open source). A field whose
// selector matches once is read directly; zero or several matches, or no
// selector, go to a Jev pick (decisions/extract.ts) with the code rule as fallback.
import { Data, Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { JEV_CONCURRENCY } from './jev/client.ts'
import { type Candidate, fieldDecision, recoverDecision } from './jev/decisions/extract.ts'
import { onJevRuntime } from './jev/run.ts'

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
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
const textOf = (el: Element) => el.textContent?.trim() ?? ''
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

const pickField = (
  document: ReturnType<typeof parseHTML>['document'],
  { name, selector }: FieldSpec,
) => {
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
  return Effect.forEach(fields, (f) => pickField(document, f), {
    concurrency: JEV_CONCURRENCY,
  }).pipe(
    Effect.map((values) => Object.fromEntries(fields.map((f, i) => [f.name, values[i] ?? '']))),
  )
}

export function selectMatches(html: string, selector: string): string[] {
  const { document } = parseHTML(html)
  return Array.from(document.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)
}
