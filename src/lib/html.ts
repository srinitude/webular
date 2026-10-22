// FOSS HTML operations: main-content extraction, HTML→Markdown, link harvest.
// Composes @mozilla/readability + linkedom + turndown (all open source).
import { isProbablyReaderable, Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import { documentBase, normalizeUrl } from '../core/url.ts'
import { imagesFrom, inlineAlts, ogImageOf, type PageImage, textOf } from './html-images.ts'
import { dropHidden, dropInvisible, sanitizeHtml } from './html-sanitize.ts'
import { addTableRule } from './html-table.ts'
import { type TitleCandidates, titleBaseline } from './jev/decisions/page-title.ts'
import { type PageMetadata, pageMetadata } from './json-ld.ts'

interface Article {
  title: string
  contentHtml: string
  text: string
}

interface PageDoc {
  title: string
  titles: TitleCandidates
  links: string[]
  images: PageImage[]
  ogImage: string
  metadata?: PageMetadata
  article: Article
}

type DomDocument = ReturnType<typeof parseHTML>['document']

// Only web links count: javascript:, mailto:, tel:, and data: hrefs are not pages.
function addLink(out: Set<string>, href: string | null, base: string): void {
  const url = href && normalizeUrl(href, base)
  if (url && /^https?:/.test(url)) out.add(url)
}

// Relative hrefs resolve against <base href> when the page sets one.
function linksFrom(document: DomDocument, pageUrl: string): string[] {
  const base = documentBase(document.querySelector('base[href]')?.getAttribute('href'), pageUrl)
  const out = new Set<string>()
  for (const anchor of document.querySelectorAll('a[href]')) {
    addLink(out, anchor.getAttribute('href'), base)
  }
  return [...out]
}

// ponytail: banners matched by class/id substring, so a "cookie-recipe" block
// goes too; add a text check if real content gets dropped.
const PAGE_BOILERPLATE =
  'nav, header, footer, aside, [role=banner], [role=navigation], [role=contentinfo], ' +
  '[class*=cookie], [id*=cookie], [class*=consent], [id*=consent]'

const dropBoilerplate = (body: DomDocument['body']): void => {
  for (const el of Array.from(body.querySelectorAll(PAGE_BOILERPLATE))) el.remove()
}

// The whole-page candidate's HTML: the body a reader sees, with hidden text and
// page chrome gone, cleaned like the non-article path below. htmlToMarkdown
// sanitizes it.
export function pageBodyHtml(html: string): string {
  const { document } = parseHTML(html)
  if (!document.documentElement || !document.body) return html
  dropHidden(document.body)
  dropBoilerplate(document.body)
  return document.body.innerHTML
}

// Plain text of a page Readability skips, read from a body dropHidden has
// already cleared of non-text and hidden elements.
function bodyText(body: DomDocument['body']): string {
  inlineAlts(body)
  // Invisible characters go first: \s matches U+FEFF, so textOf would turn it into a space.
  return textOf({ textContent: dropInvisible(body.textContent ?? '') })
}

function articleFrom(document: DomDocument, rawHtml: string): Article {
  // linkedom's document getters throw on a document with no root (empty input).
  if (!document.documentElement || !document.body)
    return { title: '', contentHtml: sanitizeHtml(rawHtml), text: '' }
  const docTitle = document.title ?? ''
  // Hidden text goes before Readability and the body-text path read the page.
  dropHidden(document.body)
  // linkedom's document satisfies the DOM surface Readability touches; the
  // libraries' type worlds don't overlap, hence the one sanctioned cast.
  // Readability mutates its document; no caller reads it afterwards, so no clone.
  const doc = document as unknown as Document
  // The readerable check skips Readability's scoring pass on non-article pages;
  // those pages still keep their body text.
  if (!isProbablyReaderable(doc)) return bodyArticle(document.body, docTitle)
  return readableArticle(doc, docTitle, rawHtml)
}

// The page's boilerplate-free body text: the path for non-article pages and the
// fallback when Readability finds no main text (trafilatura's baseline does the same).
function bodyArticle(body: DomDocument['body'], title: string): Article {
  dropBoilerplate(body)
  return { title, contentHtml: sanitizeHtml(body.innerHTML), text: bodyText(body) }
}

// The serializer hands back the article element itself, so its HTML is read
// before the alt swap and its text after, with no second parse.
function readableArticle(doc: Document, docTitle: string, rawHtml: string): Article {
  const parsed = new Readability(doc, { serializer: (node) => node as Element }).parse()
  // Readability strips the document it scores, so the fallback reads a fresh parse.
  if (!parsed?.content?.textContent?.trim()) return freshBody(rawHtml, docTitle)
  const contentHtml = sanitizeHtml(parsed.content?.innerHTML ?? '')
  if (parsed.content) inlineAlts(parsed.content as unknown as DomDocument['body'])
  const article = {
    title: dropInvisible(parsed.title ?? docTitle),
    contentHtml,
    text: dropInvisible(parsed.content?.textContent ?? ''),
  }
  if (article.text.trim().length >= THIN_TEXT) return article
  const body = freshBody(rawHtml, article.title)
  return body.text.trim().length > article.text.trim().length ? body : article
}

// ponytail: length rule. A thin pick loses to fuller body text (code, math kept).
const THIN_TEXT = 200

function freshBody(rawHtml: string, title: string): Article {
  const { body } = parseHTML(rawHtml).document
  dropHidden(body)
  return bodyArticle(body, title)
}

// ONE linkedom parse per page: titles, links, and images are read BEFORE
// Readability runs because Readability mutates the document it is given.
// `title` is the rule's pick; the page.title Jev decision may pick another of `titles`.
export function parsePage(html: string, base: string): PageDoc {
  const { document } = parseHTML(html)
  const docTitle = dropInvisible(document.title ?? '')
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? ''
  const h1 = textOf(document.querySelector('h1'))
  const links = linksFrom(document, base)
  const images = imagesFrom(document, base)
  const ogImage = ogImageOf(document, base)
  const metadata = pageMetadata(document)
  const article = articleFrom(document, html)
  const titles = {
    readability: article.title,
    document: docTitle,
    og: dropInvisible(og).trim(),
    h1: dropInvisible(h1),
  }
  const title = titleBaseline({ url: base, candidates: titles })
  return { title, titles, links, images, ogImage, ...(metadata ? { metadata } : {}), article }
}

// The fetch path's parse: article text plus the page's <img> records.
export const textAndImages = (html: string, base: string) => {
  const page = parsePage(html, base)
  const stated = page.metadata?.jsonLd.find((f) => f.datePublished)?.datePublished ?? ''
  const at = Date.parse(stated) // NaN when missing or unreadable
  const published = Number.isNaN(at) ? undefined : new Date(at).toISOString()
  return { text: page.article.text, images: page.images, ...(published ? { published } : {}) }
}

// Crawling needs only the title and links, so it skips Readability's scoring pass;
// withLinks=false also skips the anchor scan (the crawl's last level).
export function titleAndLinks(
  html: string,
  base: string,
  withLinks = true,
): { title: string; links: string[] } {
  const { document } = parseHTML(html)
  return {
    title: dropInvisible(document.title ?? ''),
    links: withLinks ? linksFrom(document, base) : [],
  }
}

export const htmlToArticle = (html: string): Article => articleFrom(parseHTML(html).document, html)

export const extractLinks = (html: string, base: string): string[] =>
  linksFrom(parseHTML(html).document, base)

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
addTableRule(turndown)
// Turndown fences only <pre><code>; fence a bare <pre> past any backtick run inside.
turndown.addRule('bare-pre', {
  filter: (node) => node.nodeName === 'PRE' && node.firstChild?.nodeName !== 'CODE',
  replacement: (_content, node) => {
    const code = (node.textContent ?? '').replace(/\n$/, '')
    const fence = '`'.repeat(Math.max(3, ...(code.match(/`+/g) ?? []).map((r) => r.length + 1)))
    return `\n\n${fence}\n${code}\n${fence}\n\n`
  },
})

// Turndown's regexes run superlinear on huge inputs (turndown #505, #506): cut past 5 MB.
const MARKDOWN_HTML_MAX_CHARS = 5_000_000

// Every Markdown path sanitizes here: Turndown never sees hidden text, script, or style.
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(sanitizeHtml(html.slice(0, MARKDOWN_HTML_MAX_CHARS))).trim()
}

export { sanitizeHtml }
