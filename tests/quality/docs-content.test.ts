// The docs build helpers: page paths, mapped-file links, footers, Markdown
// twins, and the built-link target rule.
import { expect, test } from 'bun:test'
import { footer, MAPPED, pagePath, rewrite, twin } from '../../scripts/docs-content.ts'
import { links, redirects, targets } from '../../scripts/docs-links.ts'

test('index slugs map to their folder path', () => {
  expect(pagePath('index')).toBe('/')
  expect(pagePath('agents/index')).toBe('/agents')
  expect(pagePath('guides/read-pages')).toBe('/guides/read-pages')
})

test('a mapped sibling link becomes a page link; other repo links go to GitHub', () => {
  expect(MAPPED['benchmarks/peers']).toBe('docs/benchmarks-peers.md')
  const body = rewrite(
    '[p](benchmarks-peers.md#x) [r](../README.md) [w](https://a.b)',
    'docs/benchmarks.md',
  )
  expect(body).toBe(
    '[p](/benchmarks/peers#x) [r](https://github.com/srinitude/webular/blob/main/README.md) [w](https://a.b)',
  )
})

test('the footer carries the date, the edit link, and a GitHub issue link', () => {
  const text = footer('guides/read-pages', 'docs/site/guides/read-pages.mdx', '2026-01-02')
  expect(text).toContain('Last updated 2026-01-02')
  expect(text).toContain(
    'https://github.com/srinitude/webular/blob/main/docs/site/guides/read-pages.mdx',
  )
  expect(text).toContain(
    'https://github.com/srinitude/webular/issues/new?title=Docs%3A%20%2Fguides%2Fread-pages',
  )
})

test('the Markdown twin drops tab wrappers and keeps their content', () => {
  const mdx = '<Tabs items={[\'a\']}>\n<Tab value="a">\n\n```bash\nx\n```\n\n</Tab>\n</Tabs>\n'
  expect(twin(mdx)).toBe('\n```bash\nx\n```\n\n')
})

test('built links resolve the way the static host serves them', () => {
  expect(targets('/docs/install/#upgrade')).toEqual(['docs/install/index.html'])
  expect(targets('/docs')).toEqual(['docs.html', 'docs/index.html'])
  expect(targets('/')).toEqual(['index.html'])
  expect(targets('/fonts/a.woff2?v=1')).toEqual(['fonts/a.woff2'])
  expect(
    links('<a href="/docs/x/">x</a><link href="/y.css"><script src="/z.js"><a href="//cdn/q">'),
  ).toEqual(['/docs/x/', '/y.css', '/z.js'])
  const redirected = redirects(
    '/latest  https://github.com/x  302\n/:version/install.sh  https://x 302',
  )
  expect(redirected('/latest')).toBe(true)
  expect(redirected('/0.3.2/install.sh')).toBe(true)
  expect(redirected('/other')).toBe(false)
})
