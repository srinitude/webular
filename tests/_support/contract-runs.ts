// The contract fixture site and the --json run of each URL command against it.
// tests/contract/cli.test.ts checks these runs decode with each workflow's
// schema; scripts/docs-outputs.ts records the same runs for the command pages.
import { join } from 'node:path'

export const PAGE =
  '<html><head><title>Fixture</title></head><body><h1>Hello</h1><p>Plain text here.</p></body></html>'
export const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture RSS</title>
<item><title>One</title><link>https://example.com/1</link><description>First</description></item>
</channel></rss>`
const typed = (body: BodyInit, type: string) => () =>
  new Response(body, { headers: { 'content-type': type } })

export const CONTRACT_ROUTES = {
  '/': typed(PAGE, 'text/html'),
  '/rss.xml': typed(RSS, 'application/rss+xml'),
  '/img.png': typed(new Uint8Array(64), 'image/png'),
}

// Network-only or host-tool commands skip the JSON check: search and research
// call live search providers, act drives a real browser, audit and doctor
// inspect host tools, mcp serves stdio. parse reads local files, not URLs.
export const JSON_RUNS: Record<string, (origin: string, dir: string) => string[]> = {
  scrape: (o) => ['--url', `${o}/`],
  map: (o) => ['--url', `${o}/`],
  crawl: (o) => ['--url', `${o}/`, '--limit', '1'],
  extract: (o) => ['--url', `${o}/`, '--selector', 'h1'],
  summarize: (o) => ['--url', `${o}/`],
  batch: (o) => ['--urls', `${o}/`],
  monitor: (o) => ['--url', `${o}/`],
  answer: (o) => ['--query', 'hello', '--urls', `${o}/`],
  feed: (o) => ['--url', `${o}/rss.xml`],
  media: (o, dir) => ['--url', `${o}/img.png`, '-o', join(dir, 'media.bin')],
}
