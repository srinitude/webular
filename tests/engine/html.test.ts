// HTML reliability: the shared sanitizer, short-page text, and the empty-input fallback.
import { describe, expect, test } from 'bun:test'
import { htmlToArticle, htmlToMarkdown, parsePage, sanitizeHtml } from '../../src/lib/html.ts'
import fixtureBundle from '../fixtures/html/image-report.html' with { type: 'text' }

const fixture = String(fixtureBundle)

describe('sanitizeHtml', () => {
  test('strips active elements, on* attributes, and javascript: URLs', () => {
    const out = sanitizeHtml(
      '<p onclick="x()">hi <a href=" java\tscript:alert(1)">a</a><a href="https://ok.test/">b</a></p>' +
        '<script>alert(1)</script><style>p{}</style><iframe src="//e"></iframe><object></object><embed><form><input></form>',
    )
    expect(out).not.toMatch(/script|style|iframe|object|embed|form|onclick|javascript/i)
    expect(out).toContain('https://ok.test/')
    expect(out).toContain('hi')
  })

  test('strips data:/vbscript: URLs, srcdoc, style, and document-level or foreign elements', () => {
    const out = sanitizeHtml(
      '<a href="data:text/html,x">d</a><a href="VBScript:x">v</a><p style="x">keep</p>' +
        '<iframe srcdoc="x"></iframe><div srcdoc="y"></div><base href="//e"><meta http-equiv="refresh">' +
        '<link rel="import"><template><b>t</b></template><svg><a href="#"/></svg><math><mi>m</mi></math>' +
        '<img src="https://ok.test/i.png">',
    )
    expect(out).not.toMatch(/data:|vbscript|srcdoc|style|<base|<meta|<link|<template|<svg|<math/i)
    expect(out).toContain('keep')
    expect(out).toContain('https://ok.test/i.png')
  })
})

describe('htmlToArticle', () => {
  test('a short page keeps its text and loses its scripts', () => {
    const article = htmlToArticle('<html><body><p>tiny</p><script>alert(1)</script></body></html>')
    expect(article.text).toBe('tiny')
    expect(article.contentHtml).toContain('tiny')
    expect(article.contentHtml).not.toMatch(/script/i)
  })

  test('a non-readerable page loses nav, header, footer, aside, and role landmarks but keeps main', () => {
    const article = htmlToArticle(
      '<html><body><header>HEADBAR</header><nav>NAVBAR</nav><div role="banner">ROLEBANNER</div>' +
        '<div role="navigation">ROLENAV</div><main><p>keep this</p></main><aside>SIDEBAR</aside>' +
        '<div role="contentinfo">ROLEINFO</div><footer>FOOTBAR</footer></body></html>',
    )
    expect(article.contentHtml).toContain('keep this')
    expect(article.text).toBe('keep this')
    expect(article.contentHtml).not.toMatch(
      /HEADBAR|NAVBAR|ROLEBANNER|ROLENAV|SIDEBAR|ROLEINFO|FOOTBAR/,
    )
  })

  test('empty input returns empty text instead of throwing', () => {
    expect(htmlToArticle('').text).toBe('')
  })
})

describe('htmlToArticle banners', () => {
  test('a non-readerable page loses its cookie and consent banners', () => {
    const article = htmlToArticle(
      '<html><body><div class="cookie">Accept all cookies?</div><div id="consent-bar">CONSENT</div>' +
        '<main><p>keep this</p></main></body></html>',
    )
    expect(article.text).toBe('keep this')
    expect(article.contentHtml).not.toMatch(/Accept all cookies|CONSENT/)
  })
})

describe('htmlToMarkdown tables', () => {
  test('renders a GFM pipe table with escaped pipes and collapsed whitespace', () => {
    const md = htmlToMarkdown(
      '<table><thead><tr><th>Name</th><th>Note</th></tr></thead><tbody>' +
        '<tr><td>a|b</td><td>two\n  lines</td></tr></tbody></table>',
    )
    expect(md).toBe('| Name | Note |\n| --- | --- |\n| a\\|b | two lines |')
  })
  test('uses the first row as header when there is no th', () => {
    const md = htmlToMarkdown(
      '<table><tr><td>x</td><td>y</td></tr><tr><td>1</td><td>2</td></tr></table>',
    )
    expect(md).toBe('| x | y |\n| --- | --- |\n| 1 | 2 |')
  })
})

describe('page images', () => {
  const base = 'https://acme.test/report/'

  test('a readerable page keeps its image alt text in .text', () => {
    expect(parsePage(fixture, base).article.text).toContain('Revenue 2025: $4.2M')
  })

  test('a short page keeps its image alt text in .text', () => {
    const html =
      '<html><body><p>Chart:</p><img src="c.png" alt="Revenue 2025: $4.2M"></body></html>'
    // A block break follows the paragraph, so the image's alt text starts a new line.
    expect(htmlToArticle(html).text).toBe('Chart:\nRevenue 2025: $4.2M')
  })

  test('lists every image with src, alt, srcset, size, and caption, plus og:image', () => {
    const page = parsePage(fixture, base)
    expect(page.ogImage).toBe('https://acme.test/media/cover.png')
    expect(page.images).toEqual([
      {
        src: 'https://acme.test/logo.svg',
        alt: 'Acme',
        srcset: '',
        width: '',
        height: '',
        caption: '',
      },
      {
        src: 'https://acme.test/report/charts/revenue.png',
        alt: 'Revenue 2025: $4.2M',
        srcset: 'charts/revenue.png 1x, charts/revenue@2x.png 2x',
        width: '640',
        height: '360',
        caption: 'Yearly revenue by quarter',
      },
    ])
  })
})
