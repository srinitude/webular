// Batch reads only the title, so its scrape skips both Markdown passes and the
// main pick, while the title and its candidates match the full scrape.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { prepareScrape, scrapePicks } from '../../src/workflows/scrape.ts'
import { eff } from '../_support/run.ts'

const url = 'https://example.com/a'
const html = `<html><head><title>Page Title</title><meta property="og:title" content="Other Title"></head>
<body><nav>menu</nav><article><h1>Heading</h1><p>${'Body text. '.repeat(80)}</p></article></body></html>`

test(
  'batch gets the same page title without building the Markdown body',
  eff(
    Effect.sync(() => {
      const full = prepareScrape({ url, html })
      const titleOnly = prepareScrape({ url, html }, false)
      expect(full.article).not.toBe('')
      expect(titleOnly.page?.title).toBe(full.page?.title as string)
      expect(titleOnly.page?.titles).toEqual(full.page?.titles)
      expect([titleOnly.article, titleOnly.full]).toEqual(['', ''])
      expect(scrapePicks(titleOnly)?.main).toBeUndefined()
      expect(scrapePicks(titleOnly)?.title).toEqual(scrapePicks(full)?.title)
    }),
  ),
)

test(
  'batch still reports a robots-blocked page as blocked',
  eff(
    Effect.sync(() => {
      const blocked = prepareScrape({ url, html: '', blockedBy: '/' }, false)
      expect(blocked.page).toBeUndefined()
      expect(blocked.input.blockedBy).toBe('/')
    }),
  ),
)
