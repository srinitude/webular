// Page image inventory: what the HTML already says about its images (src,
// alt, srcset, size, figcaption) plus og:image, read before Readability runs.
import type { parseHTML } from 'linkedom'

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

export function imagesFrom(document: DomDocument, base: string): PageImage[] {
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

export const ogImageOf = (document: DomDocument, base: string): string =>
  absolute(
    (document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '').trim(),
    base,
  )

// Swaps each <img alt> for its alt text in place, so page text keeps what the
// images say ("Revenue 2025: $4.2M") where they sit.
export function inlineAlts(root: Pick<DomDocument['body'], 'querySelectorAll'>): void {
  for (const img of Array.from(root.querySelectorAll('img[alt]'))) {
    const alt = (img.getAttribute('alt') ?? '').trim()
    if (alt) img.replaceWith(` ${alt} `)
  }
}
