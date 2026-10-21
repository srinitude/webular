// The snapshot record every page builder returns, and the HTML page maker.
import { byline, date, escapeHtml, page } from './generate-scrape-content'

export interface Built {
  readonly ext: 'html' | 'pdf'
  readonly bytes: Uint8Array
  readonly title: string
  readonly author: string
  readonly published: string
  readonly lang: string
  readonly with: ReadonlyArray<string>
  readonly tables?: ReadonlyArray<ReadonlyArray<ReadonlyArray<string>>>
  readonly status?: 'blocked'
  readonly reason?: string
  readonly jsLevel?: 'light' | 'heavy' | 'lazy'
}

const enc = (s: string) => new TextEncoder().encode(s)
export const ps = (xs: ReadonlyArray<string>) => xs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')

export const html = (
  seed: number,
  title: string,
  main: string,
  keep: ReadonlyArray<string>,
  extra: Partial<Built> = {},
  lang = 'en',
  head = '',
  tail = '',
): Built => {
  const author = byline(seed)
  const published = date(seed)
  return {
    ext: 'html',
    bytes: enc(page({ seed, title, author, published, lang, main, head, tail })),
    title,
    author,
    published,
    lang,
    with: keep,
    ...extra,
  }
}
