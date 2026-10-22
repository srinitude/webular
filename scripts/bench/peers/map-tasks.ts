// Map gold: small, stable public sites whose home page links each gold page,
// so a sitemap reader and a link crawler can both find them. A task passes
// only when the listing holds every gold page (page recall of 1).
import type { Task } from './model.ts'

const map = (id: string, url: string, pages: readonly string[]): Task => ({
  id,
  job: 'map',
  suite: 'map',
  input: { url },
  checks: pages.map((p) => ({ kind: 'urlMatches' as const, values: [p] })),
})

export const mapTasks: readonly Task[] = [
  map('map-iana-site', 'https://www.iana.org/', [
    'iana\\.org/domains/?$',
    'iana\\.org/protocols/?$',
    'iana\\.org/numbers/?$',
  ]),
  map('map-jsonlines-site', 'https://jsonlines.org/', [
    'jsonlines\\.org/examples/?$',
    'jsonlines\\.org/validator/?$',
    'jsonlines\\.org/on_the_web/?$',
  ]),
  map('map-sqlite-site', 'https://www.sqlite.org/', [
    'sqlite\\.org/docs\\.html$',
    'sqlite\\.org/download\\.html$',
    'sqlite\\.org/about\\.html$',
  ]),
]
