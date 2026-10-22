// HTML sanitizing: strips active content, hidden text, and invisible characters.
import { parseHTML } from 'linkedom'

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
const NEVER_RENDERED = 'script, style, noscript, template'
const HIDDEN_CANDIDATES = '[hidden], [aria-hidden], [style]'
const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden/i
const COMMENT = /<!--[\s\S]*?-->/g
// Zero-width, bidi marks, word joiners, BOM, and Unicode tag characters.
const INVISIBLE_CHARS = /[​-‏⁠-⁤﻿\u{E0000}-\u{E007F}]/gu

export const dropInvisible = (text: string): string => text.replace(INVISIBLE_CHARS, '')

// Removes never-rendered elements and hidden ones in place.
export function dropHidden(root: DomDocument['body']): void {
  for (const el of Array.from(root.querySelectorAll(NEVER_RENDERED))) el.remove()
  for (const el of Array.from(root.querySelectorAll(HIDDEN_CANDIDATES))) {
    const hidden =
      el.hasAttribute('hidden') ||
      el.getAttribute('aria-hidden') === 'true' ||
      HIDDEN_STYLE.test(el.getAttribute('style') ?? '')
    if (hidden) el.remove()
  }
}

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
  for (const el of Array.from(document.querySelectorAll(UNSAFE_ELEMENTS))) el.remove()
  dropHidden(document.body)
  for (const el of Array.from(document.querySelectorAll('*'))) {
    for (const name of el.getAttributeNames()) {
      if (unsafeAttr(name, el.getAttribute(name) ?? '')) el.removeAttribute(name)
    }
  }
  return dropInvisible(document.body.innerHTML.replace(COMMENT, ''))
}
