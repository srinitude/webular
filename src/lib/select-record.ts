// Listing pages repeat one record shape: pick the selector for the biggest run.
import { parseVisible, SKIP, textOf } from './select-dom.ts'

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
