// FOSS HTML operations: main-content extraction, HTML→Markdown, link harvest.
// Composes @mozilla/readability + linkedom + turndown (all open source).
import { isProbablyReaderable, Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import { addTableRule } from './html-table.ts'
import { type TitleCandidates, titleBaseline } from './jev/decisions/page-title.ts'

interface Article {
  title: string
  contentHtml: string
  text: string
}

interface PageDoc {
  title: string
  titles: TitleCandidates
  links: string[]
  article: Article
}

type DomDocument = ReturnType<typeof parseHTML>['document']

function addLink(out: Set<string>, href: string | null, base: string): void {
  if (href && URL.canParse(href, base)) out.add(new URL(href, base).toString())
}

function linksFrom(document: DomDocument, base: string): string[] {
  const out = new Set<string>()
  for (const anchor of document.querySelectorAll('a[href]')) {
    addLink(out, anchor.getAttribute('href'), base)
  }
  return [...out]
}

// Active, document-level (base, meta, link), inert-template, and foreign
// (svg, math) content: each can run script or re-point URLs once embedded.
const UNSAFE_ELEMENTS =
  'script, style, iframe, frame, frameset, object, embed, applet, form, ' +
  'base, meta, link, template, svg, math, noscript'
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'background']
const UNSAFE_ATTRS = ['srcdoc', 'style']
const UNSAFE_SCHEME = /^(javascript|vbscript|data):/

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
// embeds it. Strips the elements above, on* handlers, srcdoc, inline style, and
// javascript:, vbscript:, and data: URLs.
// ponytail: a widened denylist, not an allowlist; DOMPurify if a gap shows up.
export function sanitizeHtml(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  for (const el of Array.from(document.querySelectorAll(UNSAFE_ELEMENTS))) el.remove()
  for (const el of Array.from(document.querySelectorAll('*'))) {
    for (const name of el.getAttributeNames()) {
      if (unsafeAttr(name, el.getAttribute(name) ?? '')) el.removeAttribute(name)
    }
  }
  return document.body?.innerHTML ?? ''
}

// ponytail: banners matched by class/id substring, so a "cookie-recipe" block
// goes too; add a text check if real content gets dropped.
const PAGE_BOILERPLATE =
  'nav, header, footer, aside, [role=banner], [role=navigation], [role=contentinfo], ' +
  '[class*=cookie], [id*=cookie], [class*=consent], [id*=consent]'

// Plain text of a page Readability skips, read from the already-parsed body.
// Removes non-text elements in place: no caller reads the document afterwards.
function bodyText(body: DomDocument['body']): string {
  for (const el of Array.from(body.querySelectorAll('script, style, noscript'))) el.remove()
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function articleFrom(document: DomDocument, rawHtml: string): Article {
  // linkedom's document getters throw on a document with no root (empty input).
  if (!document.documentElement || !document.body)
    return { title: '', contentHtml: sanitizeHtml(rawHtml), text: '' }
  const docTitle = document.title ?? ''
  // linkedom's document satisfies the DOM surface Readability touches; the
  // libraries' type worlds don't overlap, hence the one sanctioned cast.
  // Readability mutates its document; no caller reads it afterwards, so no clone.
  const doc = document as unknown as Document
  // The readerable check skips Readability's scoring pass on non-article pages;
  // those pages still keep their body text.
  if (!isProbablyReaderable(doc)) {
    for (const el of Array.from(document.body.querySelectorAll(PAGE_BOILERPLATE))) el.remove()
    return {
      title: docTitle,
      contentHtml: sanitizeHtml(document.body.innerHTML),
      text: bodyText(document.body),
    }
  }
  const parsed = new Readability(doc).parse()
  if (!parsed) return { title: docTitle, contentHtml: sanitizeHtml(rawHtml), text: '' }
  return {
    title: parsed.title ?? docTitle,
    contentHtml: sanitizeHtml(parsed.content ?? ''),
    text: parsed.textContent ?? '',
  }
}

const textOf = (el: { textContent: string | null } | null): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

// ONE linkedom parse per page: titles and links are read BEFORE Readability
// runs because Readability mutates the document it is given. `title` is the
// rule's pick; the page.title Jev decision may pick another of `titles`.
export function parsePage(html: string, base: string): PageDoc {
  const { document } = parseHTML(html)
  const docTitle = document.title ?? ''
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? ''
  const h1 = textOf(document.querySelector('h1'))
  const links = linksFrom(document, base)
  const article = articleFrom(document, html)
  const titles = { readability: article.title, document: docTitle, og: og.trim(), h1 }
  return { title: titleBaseline({ url: base, candidates: titles }), titles, links, article }
}

// Crawling needs only the title and links — skipping Readability here saves
// its full-document scoring pass on every crawled page.
// withLinks=false skips the anchor scan for pages whose links are never used
// (the crawl's last level).
export function titleAndLinks(
  html: string,
  base: string,
  withLinks = true,
): { title: string; links: string[] } {
  const { document } = parseHTML(html)
  return { title: document.title ?? '', links: withLinks ? linksFrom(document, base) : [] }
}

export function htmlToArticle(html: string): Article {
  return articleFrom(parseHTML(html).document, html)
}

export function extractLinks(html: string, base: string): string[] {
  return linksFrom(parseHTML(html).document, base)
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
addTableRule(turndown)

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim()
}
