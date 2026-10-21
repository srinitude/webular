// Hidden-text prompt injection: text a reader never sees must not reach the
// Markdown or plain text an agent reads.
import { describe, expect, test } from 'bun:test'
import { htmlToArticle, htmlToMarkdown, sanitizeHtml } from '../../src/lib/html.ts'

const INJECTED =
  '<p hidden>HIDDENATTR</p><div style="DISPLAY : none">DISPLAYNONE</div>' +
  '<span style="visibility:hidden">VISHIDDEN</span><span aria-hidden="true">ARIAHIDDEN</span>' +
  '<script>SCRIPTTEXT</script><style>STYLETEXT{}</style><noscript>NOSCRIPTTEXT</noscript>' +
  '<template>TEMPLATETEXT</template><!-- COMMENTTEXT -->' +
  '<p>Visible&#8203;text&#xFEFF;here‍⁠\u{E0041}</p>'
const LEAKS =
  /HIDDENATTR|DISPLAYNONE|VISHIDDEN|ARIAHIDDEN|SCRIPTTEXT|STYLETEXT|NOSCRIPTTEXT|TEMPLATETEXT|COMMENTTEXT|<!--/
const INVISIBLE = /[​-‏⁠-⁤﻿\u{E0000}-\u{E007F}]/u

describe('hidden-text injection', () => {
  test('sanitized Markdown keeps visible text and drops every hidden channel', () => {
    const md = htmlToMarkdown(sanitizeHtml(INJECTED))
    expect(md).toBe('Visibletexthere')
    expect(md).not.toMatch(LEAKS)
    expect(md).not.toMatch(INVISIBLE)
  })

  test('the article text and HTML of a short page drop every hidden channel', () => {
    const article = htmlToArticle(`<html><body>${INJECTED}</body></html>`)
    expect(article.text).toBe('Visibletexthere')
    expect(article.contentHtml).not.toMatch(LEAKS)
    expect(article.contentHtml).not.toMatch(INVISIBLE)
  })

  test('a readerable article drops hidden text too', () => {
    const para = '<p>Real article sentence that is long enough to count as content. </p>'
    const article = htmlToArticle(
      `<html><body><article>${para.repeat(12)}${INJECTED}</article></body></html>`,
    )
    expect(article.text).toContain('Real article sentence')
    expect(article.text).not.toMatch(LEAKS)
    expect(article.text).not.toMatch(INVISIBLE)
    expect(htmlToMarkdown(article.contentHtml)).not.toMatch(LEAKS)
  })
})
