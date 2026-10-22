// Page image inventory: what the HTML already says about its images (src,
// alt, srcset, size, figcaption) plus og:image, read before Readability runs.
import type { parseHTML } from 'linkedom'
import { documentBase } from '../core/url.ts'

type DomDocument = ReturnType<typeof parseHTML>['document']

export interface PageImage {
  readonly src: string
  readonly alt: string
  readonly srcset: string
  readonly width: string
  readonly height: string
  readonly caption: string
}

export const textOf = (el: { textContent: string | null } | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

const absolute = (href: string, base: string): string =>
  href ? (URL.parse(href, base)?.href ?? href) : ''

// Image URLs resolve against <base href> when the page sets one.
const baseOf = (document: DomDocument, pageUrl: string): string =>
  documentBase(document.querySelector('base[href]')?.getAttribute('href'), pageUrl)

export function imagesFrom(document: DomDocument, pageUrl: string): PageImage[] {
  const base = baseOf(document, pageUrl)
  return Array.from(document.querySelectorAll('img[src]'), (img) => {
    const attr = (name: string): string => (img.getAttribute(name) ?? '').trim()
    return {
      src: absolute(attr('src'), base),
      alt: attr('alt'),
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
// images say ("Revenue 2025: $4.2M") where they sit.
export function inlineAlts(root: Pick<DomDocument['body'], 'querySelectorAll'>): void {
  for (const img of Array.from(root.querySelectorAll('img[alt]'))) {
    const alt = (img.getAttribute('alt') ?? '').trim()
    if (alt) img.replaceWith(` ${alt} `)
  }
}
