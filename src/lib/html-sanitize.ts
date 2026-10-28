// HTML sanitizing: strips active content, hidden text, and invisible characters.
import { parseHTML } from 'linkedom'
import { removeAll } from '../core/remove-all.ts'

type DomDocument = ReturnType<typeof parseHTML>['document']

// Active, document-level (base, meta, link), inert-template, and foreign
// (svg, math) content: each can run script or re-point URLs once embedded.
const UNSAFE_ELEMENTS =
  'script, style, iframe, frame, frameset, object, embed, applet, form, ' +
  'base, meta, link, template, svg, math, noscript'
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'background']
const UNSAFE_ATTRS = ['srcdoc', 'style']
const UNSAFE_SCHEME = /^(javascript|vbscript|data):/

// Text a reader never sees is a prompt-injection channel for the agent that
// reads webular's output: hidden elements, comments, and invisible characters.
// ponytail: inline style and attributes only; stylesheet-hidden text (class
// rules, off-screen positioning, white-on-white) needs a CSS cascade to catch.
// An SVG's <title> and <desc> are tooltip and accessibility labels, not page text.
const NEVER_RENDERED = 'script, style, noscript, template, svg title, svg desc'
const HIDDEN_CANDIDATES = '[hidden], [aria-hidden], [style]'
const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden/i
const COMMENT = /<!--[\s\S]*?-->/g
// Zero-width, bidi marks, word joiners, BOM, and Unicode tag characters.
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u{E007F}]/gu

export const dropInvisible = (text: string): string => text.replace(INVISIBLE_CHARS, '')

interface HtmlNode {
  readonly parentElement: HtmlNode | null
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
}

const isHidden = (el: HtmlNode): boolean =>
  el.hasAttribute('hidden') ||
  el.getAttribute('aria-hidden') === 'true' ||
  HIDDEN_STYLE.test(el.getAttribute('style') ?? '')

// True when the element or any ancestor is hidden, for reads before dropHidden.
export const insideHidden = (el: HtmlNode | null): boolean =>
  el !== null && (isHidden(el) || insideHidden(el.parentElement))

// Removes never-rendered elements and hidden ones in place.
export function dropHidden(root: DomDocument['body']): void {
  for (const el of Array.from(root.querySelectorAll(NEVER_RENDERED))) el.remove()
  for (const el of Array.from(root.querySelectorAll(HIDDEN_CANDIDATES))) {
    if (isHidden(el)) el.remove()
  }
}

export const textOf = (el: { textContent: string | null } | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

const unsafeAttr = (name: string, value: string): boolean => {
  // Browsers ignore control chars/whitespace inside the scheme ("java\tscript:").
  // biome-ignore lint/suspicious/noControlCharactersInRegex: browsers drop C0 control chars inside a URL scheme, so the sanitizer must too.
  const scheme = value.replace(/[\u0000- ]/g, '').toLowerCase()
  const lower = name.toLowerCase()
  return (
    lower.startsWith('on') ||
    UNSAFE_ATTRS.includes(lower) ||
    (URL_ATTRS.includes(lower) && UNSAFE_SCHEME.test(scheme))
  )
}

// Neither Readability nor mammoth sanitizes its HTML — run this before anyone
// embeds it. Strips the elements above, hidden elements, comments, invisible
// characters, on* handlers, srcdoc, inline style, and javascript:, vbscript:,
// and data: URLs.
// ponytail: a widened denylist, not an allowlist; DOMPurify if a gap shows up.
export function sanitizeHtml(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  if (!document.body) return ''
  dropHidden(document.body)
  // A formula is page text: keep its alt text, TeX source, or plain text as a
  // text node before the foreign <math> element goes.
  for (const el of Array.from(document.querySelectorAll('math'))) {
    const tex = el.querySelector('annotation[encoding="application/x-tex"]')
    el.replaceWith(el.getAttribute('alttext') || textOf(tex) || textOf(el))
  }
  for (const el of Array.from(document.querySelectorAll(UNSAFE_ELEMENTS))) el.remove()
  // Turndown reads a code block's text, where a <br> would vanish and glue lines.
  for (const br of Array.from(document.querySelectorAll('pre br'))) br.replaceWith('\n')
  for (const el of Array.from(document.querySelectorAll('*'))) {
    for (const name of el.getAttributeNames()) {
      if (unsafeAttr(name, el.getAttribute(name) ?? '')) el.removeAttribute(name)
    }
  }
  return dropInvisible(removeAll(document.body.innerHTML, COMMENT))
}
