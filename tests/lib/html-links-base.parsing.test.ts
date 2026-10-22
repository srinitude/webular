// Link harvest: relative hrefs resolve against <base href>, and only web
// (http/https) links come back; javascript:, mailto:, tel:, data: never do.
import { expect, test } from 'bun:test'
import { extractLinks } from '../../src/lib/html.ts'

test('relative links resolve against <base href>', () => {
  const html = '<html><head><base href="/docs/v2/"></head><body><a href="intro">i</a></body></html>'
  expect(extractLinks(html, 'https://x.dev/page')).toEqual(['https://x.dev/docs/v2/intro'])
})

test('non-web schemes are dropped', () => {
  const html =
    '<a href="javascript:void(0)">j</a><a href="mailto:a@x.dev">m</a><a href="tel:+1555">t</a>' +
    '<a href="data:text/html,hi">d</a><a href="/ok">ok</a>'
  expect(extractLinks(html, 'https://x.dev/')).toEqual(['https://x.dev/ok'])
})
