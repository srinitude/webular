// Crawl gold. The local fixture site holds an index page that links two pages,
// and one of those links a third at depth 2. A task passes only when the crawl
// lists every gold page (page recall of 1) and each page's gold text is present.
// The fixture is unreachable from a hosted API, so only local arms run it; the
// public task checks page recall alone, on the same pages as the map job.
import type { Task } from './model.ts'

const page = (title: string, body: string, links: readonly string[]) =>
  new Response(
    `<!doctype html><html><head><title>${title}</title></head><body><main><article><h1>${title}</h1><p>${body}</p>${links
      .map((l) => `<p><a href="${l}">${l}</a></p>`)
      .join('')}</article></main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )

export const crawlRoutes = {
  '/crawl': () =>
    page('Harbor Notes', 'Notes from the harbor office.', ['/crawl/tides', '/crawl/ships']),
  '/crawl/tides': () =>
    page('Tide Tables', 'The spring tide at Pier Nine peaks at 4.2 metres.', ['/crawl/lighthouse']),
  '/crawl/ships': () =>
    page('Ship Registry', 'The brigantine Marigold carries registry number 7731.', []),
  '/crawl/lighthouse': () =>
    page('Lighthouse Log', 'The beacon on Cape Alder flashes every eleven seconds.', []),
}

const gold = [
  ['crawl/tides', '4.2 metres'],
  ['crawl/ships', 'registry number 7731'],
  ['crawl/lighthouse', 'every eleven seconds'],
] as const

export const crawlTasks: readonly Task[] = [
  {
    id: 'crawl-fixture-harbor',
    job: 'crawl',
    suite: 'crawl',
    localOnly: true,
    input: { url: '{fixture}/crawl' },
    checks: gold.flatMap(([path, text]) => [
      { kind: 'urlMatches' as const, values: [`${path}/?$`] },
      { kind: 'contains' as const, values: [text] },
    ]),
  },
  {
    id: 'crawl-jsonlines-site',
    job: 'crawl',
    suite: 'crawl',
    input: { url: 'https://jsonlines.org/' },
    checks: ['examples', 'validator', 'on_the_web'].map((p) => ({
      kind: 'urlMatches' as const,
      values: [`jsonlines\\.org/${p}/?$`],
    })),
  },
]
