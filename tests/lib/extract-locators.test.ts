// Extract without a model: a ranked locator ladder, schema.org Dataset and
// Legislation JSON-LD, and date/author/offer aliases read from structured data.
// Run with WEBULAR_JEV=off so a missed locator would fall to the code rule.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { pageMetadata } from '../../src/lib/json-ld.ts'
import { repeatedRecordSelector, selectFields, selectMatches } from '../../src/lib/select.ts'
import { eff } from '../_support/run.ts'

const pick = (html: string, ...names: string[]) =>
  selectFields(
    html,
    names.map((name) => ({ name, selector: '' })),
  )
const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`

test(
  'locator ladder: role, then data-testid, then aria-label, then label text',
  eff(
    Effect.gen(function* () {
      const html = `<body>
    <p>decoy</p>
    <span aria-label="total">aria-total</span>
    <span data-testid="total">testid-total</span>
    <span role="total">role-total</span>
    <b data-testid="owner">Ada</b><span aria-label="owner">aria-owner</span>
    <span aria-label="city">Oslo</span>
    <dt>Phone</dt><dd>555-0100</dd></body>`
      expect(yield* pick(html, 'total', 'owner', 'city', 'phone')).toEqual({
        total: 'role-total',
        owner: 'Ada',
        city: 'Oslo',
        phone: '555-0100',
      })
    }),
  ),
)

test('JSON-LD keeps Legislation identifiers and Dataset download links', () => {
  const doc = parseHTML(
    `<html><head>${ld([
      {
        '@type': 'Legislation',
        name: 'Act 7',
        legislationIdentifier: 'SI 2026/7',
        legislationType: { name: 'Act' },
      },
      {
        '@type': 'Dataset',
        name: 'Rain',
        distribution: [
          {
            '@type': 'DataDownload',
            contentUrl: 'https://d.test/rain.csv',
            encodingFormat: 'text/csv',
          },
        ],
      },
    ])}</head></html>`,
  ).document
  expect(pageMetadata(doc)?.jsonLd).toEqual([
    { name: 'Act 7', legislationIdentifier: 'SI 2026/7', legislationType: 'Act' },
    { name: 'Rain', distribution: ['https://d.test/rain.csv'] },
  ])
})

test('a listing page of repeated sibling records yields one selector for all of them', () => {
  const html = `<body><nav><a href="/">Home</a><a href="/b">Blog</a></nav><main>
    <h1>Shoes</h1>${[1, 2, 3, 4, 5].map((n) => `<div class="card big"><h2>Shoe ${n}</h2></div>`).join('')}
    </main></body>`
  const selector = repeatedRecordSelector(html)
  expect(selector).toBe('body > main > div.card.big')
  expect(selectMatches(html, selector ?? '')).toHaveLength(5)
  expect(repeatedRecordSelector('<body><p>one</p><p>two</p></body>')).toBeUndefined()
})

test(
  'date, author, and offer read JSON-LD, microdata, and og: meta first',
  eff(
    Effect.gen(function* () {
      const html = `<html><head>
    <meta property="article:published_time" content="2026-03-04">
    ${ld({ '@type': 'Product', author: { name: 'Ada' }, offers: { '@type': 'Offer', price: '9.50' } })}
    </head><body><span itemprop="datePublished" content="2026-01-02"></span></body></html>`
      expect(yield* pick(html, 'date', 'author', 'offer')).toEqual({
        date: '2026-01-02',
        author: 'Ada',
        offer: '9.50',
      })
      const metaOnly = `<html><head><meta property="article:published_time" content="2026-03-04"></head></html>`
      expect(yield* pick(metaOnly, 'date')).toEqual({ date: '2026-03-04' })
    }),
  ),
)

test(
  'a title selector the page no longer matches returns the page title',
  eff(
    Effect.gen(function* () {
      const html = '<html><head><title>Example Domain</title></head><body><p>Hi</p></body></html>'
      const got = yield* selectFields(html, [{ name: 'title', selector: 'h1' }])
      expect(got).toEqual({ title: 'Example Domain' })
    }),
  ),
)
