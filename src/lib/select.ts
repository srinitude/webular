// FOSS CSS-selector helpers built on linkedom (open source).
import { Data, Effect } from 'effect'
import { parseHTML } from 'linkedom'

interface FieldSpec {
  name: string
  selector: string
}

export class InvalidFieldSpecError extends Data.TaggedError('InvalidFieldSpecError')<{
  message: string
}> {}

export function parseFieldSpecs(raw: string): Effect.Effect<FieldSpec[], InvalidFieldSpecError> {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return Effect.forEach(
    parts,
    (part) => {
      const colon = part.indexOf(':')
      if (colon < 1) {
        return Effect.fail(
          new InvalidFieldSpecError({
            message: `invalid field spec "${part}" — expected "name:selector"`,
          }),
        )
      }
      return Effect.succeed({
        name: part.slice(0, colon).trim(),
        selector: part.slice(colon + 1).trim(),
      })
    },
    { concurrency: 1 },
  )
}

export function selectFields(html: string, fields: FieldSpec[]): Record<string, string> {
  const { document } = parseHTML(html)
  const result: Record<string, string> = {}
  for (const { name, selector } of fields) {
    result[name] = document.querySelector(selector)?.textContent?.trim() ?? ''
  }
  return result
}

export function selectMatches(html: string, selector: string): string[] {
  const { document } = parseHTML(html)
  return Array.from(document.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)
}
