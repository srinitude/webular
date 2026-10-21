// Renders one crawl.map site model into static fixture files (path, body).
import { CANARY } from './generate-common'
import { EXTRA, type Page, type Site } from './generate-crawl-model'

const MARK = `<!-- ${CANARY} -->`
// Every page sits at the site root or one folder down, so links stay relative
// and work wherever the fixture server mounts the site.
const rel = (from: string, to: string) => (from.split('/').length > 2 ? '../' : '') + to.slice(1)

const html = (title: string, body: string) =>
  `<!doctype html>\n${MARK}\n<html><head><meta charset="utf-8"><title>${title}</title></head><body>\n${body}\n</body></html>\n`

const a = (from: string, to: string) => `<a href="${rel(from, to)}">${to}</a>`

const JS_LINK = `<script>const hidden = 'js/hid' + 'den.html'; void hidden</script>`

const pageHtml = (site: Site, p: Page) => {
  const isHome = p.path === '/index.html'
  const links = [
    ...p.links.map((l) => a(p.path, l)),
    ...p.links.slice(0, 1).map((l) => `<a href="${rel(p.path, l)}?ref=nav">dup</a>`),
    isHome ? a(p.path, EXTRA.redirect) : a(p.path, '/index.html'),
    isHome && site.sitemap ? a(p.path, EXTRA.private) : '',
    '<a href="https://example.org/off-scope">off-scope</a>',
    isHome ? JS_LINK : '',
  ]
  return html(p.title, `<h1>${p.title}</h1>\n${links.filter(Boolean).join('\n')}`)
}

const sitemapXml = (site: Site) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n${MARK}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${site.sitemapPaths.map((s) => `<url><loc>${s.slice(1)}</loc></url>`).join('\n')}\n</urlset>\n`

// robots.txt cannot hold an HTML comment, so its canary is a # comment.
const crawlerFiles = (site: Site): ReadonlyArray<readonly [string, string]> =>
  site.sitemap
    ? [
        [EXTRA.private, html('Staff', a(EXTRA.private, '/index.html'))],
        ['/robots.txt', `# ${CANARY}\nUser-agent: *\nDisallow: /private/\nSitemap: sitemap.xml\n`],
        ['/sitemap.xml', sitemapXml(site)],
      ]
    : []

export const files = (site: Site): ReadonlyArray<readonly [string, string]> => [
  ...site.pages.map((p) => [p.path, pageHtml(site, p)] as const),
  [EXTRA.orphan, html('Orphan', a(EXTRA.orphan, '/index.html'))],
  [EXTRA.redirect, html('Moved', '<meta http-equiv="refresh" content="0; url=index.html">')],
  [EXTRA.jsOnly, html('Hidden', a(EXTRA.jsOnly, '/index.html'))],
  ...crawlerFiles(site),
]
