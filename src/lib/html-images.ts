// Page image inventory: what the HTML already says about its images (src,
// alt, srcset, size, figcaption) plus og:image, read before Readability runs.
import type { parseHTML } from 'linkedom'
import type TurndownService from 'turndown'
import { documentBase } from '../core/url.ts'
import { insideHidden, textOf } from './html-sanitize.ts'

type DomDocument = ReturnType<typeof parseHTML>['document']

export interface PageImage {
  readonly src: string
  readonly alt: string
  readonly srcset: string
  readonly width: string
  readonly height: string
  readonly caption: string
}

const absolute = (href: string, base: string): string =>
  href ? (URL.parse(href, base)?.href ?? href) : ''

// Image URLs resolve against <base href> when the page sets one.
const baseOf = (document: DomDocument, pageUrl: string): string =>
  documentBase(document.querySelector('base[href]')?.getAttribute('href'), pageUrl)

// Alt text is author text that can carry injected instructions (2511.16397).
// ponytail: a flat cap; WCAG advice keeps real alt text far shorter.
const ALT_MAX = 300
const altOf = (img: { getAttribute(name: string): string | null }): string =>
  (img.getAttribute('alt') ?? '').trim().slice(0, ALT_MAX)

// Read before dropHidden, so a hidden image and its alt are skipped here.
export function imagesFrom(document: DomDocument, pageUrl: string): PageImage[] {
  const base = baseOf(document, pageUrl)
  const shown = Array.from(document.querySelectorAll('img[src]')).filter(
    (img) => !insideHidden(img),
  )
  return shown.map((img) => {
    const attr = (name: string): string => (img.getAttribute(name) ?? '').trim()
    return {
      src: absolute(attr('src'), base),
      alt: altOf(img),
      srcset: attr('srcset'),
      width: attr('width'),
      height: attr('height'),
      caption: textOf(img.closest('figure')?.querySelector('figcaption')),
    }
  })
}

export const ogImageOf = (document: DomDocument, pageUrl: string): string =>
  absolute(
    (document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '').trim(),
    baseOf(document, pageUrl),
  )

// Every downloadable media URL on the page, absolute and deduped: img src and
// srcset, picture/video/audio sources, and og:image. data: URIs are not downloads.
export function mediaUrlsFrom(document: DomDocument, pageUrl: string): string[] {
  const base = baseOf(document, pageUrl)
  const out = new Set<string>([ogImageOf(document, pageUrl)])
  const add = (href: string) => {
    const abs = absolute(href.trim(), base)
    if (/^https?:/i.test(abs)) out.add(abs)
  }
  for (const el of Array.from(document.querySelectorAll('img, source, video, audio'))) {
    add(el.getAttribute('src') ?? '')
    for (const cand of (el.getAttribute('srcset') ?? '').split(','))
      add(cand.trim().split(/\s+/)[0] ?? '')
  }
  out.delete('')
  return [...out]
}

// Swaps each <img alt> for its alt text in place, so page text keeps what the
// images say ("Revenue 2025: $4.2M") where they sit. Each block element then
// ends with a line break, so minified HTML (`</p><p>`) never glues the last
// sentence of one paragraph to the next in the page text.
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,div,br,tr,blockquote,pre,section,article'
export function inlineAlts(root: Pick<DomDocument['body'], 'querySelectorAll'>): void {
  for (const img of Array.from(root.querySelectorAll('img[alt]'))) {
    const alt = altOf(img)
    if (alt) img.replaceWith(` ${alt} `)
  }
  for (const el of Array.from(root.querySelectorAll(BLOCKS))) el.after('\n')
}

// A Markdown image loads its URL as soon as a reader renders it, which can send
// page data to any host the page names. Each image becomes a marked plain link
// instead, which loads nothing until someone opens it.
export const addImageRule = (service: TurndownService): void => {
  service.addRule('image', {
    filter: 'img',
    replacement: (_content, node) => {
      const src = (node as Element).getAttribute('src')?.trim() ?? ''
      const alt = altOf(node as Element).replace(/\s+/g, ' ').replace(/[[\]\\]/g, '\\$&')
      return src ? `[image: ${alt}](${src})` : ''
    },
  })
}
