// FOSS HTML operations: main-content extraction, HTML→Markdown, link harvest.
// Composes @mozilla/readability + linkedom + turndown (all open source).
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'

export interface Article {
  title: string
  contentHtml: string
  text: string
}

export function htmlToArticle(html: string): Article {
  const { document } = parseHTML(html)
  const parsed = new Readability(document as unknown as Document).parse()
  if (!parsed) return { title: document.title ?? '', contentHtml: html, text: '' }
  return {
    title: parsed.title ?? '',
    contentHtml: parsed.content ?? '',
    text: parsed.textContent ?? '',
  }
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim()
}

function addLink(out: Set<string>, href: string | null, base: string): void {
  if (!href) return
  try {
    out.add(new URL(href, base).toString())
  } catch {
    /* skip invalid hrefs */
  }
}

export function extractLinks(html: string, base: string): string[] {
  const { document } = parseHTML(html)
  const out = new Set<string>()
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    addLink(out, anchor.getAttribute('href'), base)
  }
  return [...out]
}
