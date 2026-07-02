// FOSS HTML operations: main-content extraction, HTML→Markdown, link harvest.
// Composes @mozilla/readability + linkedom + turndown (all open source).
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'

interface Article {
  title: string
  contentHtml: string
  text: string
}

interface PageDoc {
  title: string
  links: string[]
  article: Article
}

type DomDocument = ReturnType<typeof parseHTML>['document']

function addLink(out: Set<string>, href: string | null, base: string): void {
  if (!href) return
  try {
    out.add(new URL(href, base).toString())
  } catch {
    /* skip invalid hrefs */
  }
}

function linksFrom(document: DomDocument, base: string): string[] {
  const out = new Set<string>()
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    addLink(out, anchor.getAttribute('href'), base)
  }
  return [...out]
}

function articleFrom(document: DomDocument, rawHtml: string): Article {
  const docTitle = document.title ?? ''
  // linkedom's document satisfies the DOM surface Readability touches; the
  // libraries' type worlds don't overlap, hence the one sanctioned cast.
  const parsed = new Readability(document as unknown as Document).parse()
  if (!parsed) return { title: docTitle, contentHtml: rawHtml, text: '' }
  return {
    title: parsed.title ?? docTitle,
    contentHtml: parsed.content ?? '',
    text: parsed.textContent ?? '',
  }
}

// ONE linkedom parse per page: title and links are read BEFORE Readability
// runs because Readability mutates the document it is given.
export function parsePage(html: string, base: string): PageDoc {
  const { document } = parseHTML(html)
  const docTitle = document.title ?? ''
  const links = linksFrom(document, base)
  const article = articleFrom(document, html)
  return { title: article.title || docTitle, links, article }
}

// Crawling needs only the title and links — skipping Readability here saves
// its full-document scoring pass on every crawled page.
export function titleAndLinks(html: string, base: string): { title: string; links: string[] } {
  const { document } = parseHTML(html)
  return { title: document.title ?? '', links: linksFrom(document, base) }
}

export function htmlToArticle(html: string): Article {
  return articleFrom(parseHTML(html).document, html)
}

export function extractLinks(html: string, base: string): string[] {
  return linksFrom(parseHTML(html).document, base)
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim()
}
