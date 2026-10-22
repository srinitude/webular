// DOM text helpers shared by the selector modules.
import { parseHTML } from 'linkedom'
import { dropHidden } from './html-sanitize.ts'

// Script, style, and hidden text never reach a field: a matched element's
// textContent would otherwise carry them.
export const parseVisible = (html: string) => {
  const { document } = parseHTML(html)
  if (document.documentElement) dropHidden(document.documentElement)
  return document
}

export const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
// Source line breaks and indents are layout, not data: runs of white space read as one space.
export const textOf = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
