// FOSS HTML operations: main-content extraction, HTML→Markdown, link harvest.
// Composes @mozilla/readability + linkedom + turndown (all open source).
import { isProbablyReaderable, Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import { imagesFrom, inlineAlts, ogImageOf, type PageImage, textOf } from './html-images.ts'
import { dropHidden, dropInvisible, sanitizeHtml } from './html-sanitize.ts'
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
  images: PageImage[]
  ogImage: string
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
  if (!isProbablyReaderable(doc)) {
    dropBoilerplate(document.body)
    return {
      title: docTitle,
      contentHtml: sanitizeHtml(document.body.innerHTML),
      text: bodyText(document.body),
    }
  }
  return readableArticle(doc, docTitle, rawHtml)
}

// The serializer hands back the article element itself, so its HTML is read
// before the alt swap and its text after, with no second parse.
function readableArticle(doc: Document, docTitle: string, rawHtml: string): Article {
  const parsed = new Readability(doc, { serializer: (node) => node as Element }).parse()
  if (!parsed) return { title: docTitle, contentHtml: sanitizeHtml(rawHtml), text: '' }
  const contentHtml = sanitizeHtml(parsed.content?.innerHTML ?? '')
  if (parsed.content) inlineAlts(parsed.content as unknown as DomDocument['body'])
  return {
    title: parsed.title ?? docTitle,
    contentHtml,
    text: dropInvisible(parsed.content?.textContent ?? ''),
  }
}

// ONE linkedom parse per page: titles, links, and images are read BEFORE
// Readability runs because Readability mutates the document it is given.
// `title` is the rule's pick; the page.title Jev decision may pick another of `titles`.
export function parsePage(html: string, base: string): PageDoc {
  const { document } = parseHTML(html)
  const docTitle = document.title ?? ''
  const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? ''
  const h1 = textOf(document.querySelector('h1'))
  const links = linksFrom(document, base)
  const images = imagesFrom(document, base)
  const ogImage = ogImageOf(document, base)
  const article = articleFrom(document, html)
  const titles = { readability: article.title, document: docTitle, og: og.trim(), h1 }
  const title = titleBaseline({ url: base, candidates: titles })
  return { title, titles, links, images, ogImage, article }
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

// Every Markdown path sanitizes here, so no caller can hand Turndown hidden
// text, script, or style from raw HTML.
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(sanitizeHtml(html)).trim()
}

export { sanitizeHtml }
