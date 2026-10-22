// Batch gold: a set of pages scraped in one call. A task passes only when every
// page is scraped (scrape accuracy per URL): the fixture task needs each page's
// URL back with text, the public task needs each page's gold title text. webular's
// batch returns the page title, so a public gold value is a title word too.
import type { Task } from './model.ts'

const batch = (
  id: string,
  urls: readonly string[],
  checks: Task['checks'],
  localOnly = false,
): Task => ({
  id,
  job: 'batch',
  suite: 'batch',
  localOnly,
  input: { url: urls.join(',') },
  checks,
})

export const batchTasks: readonly Task[] = [
  batch(
    'batch-fixture-pages',
    ['{fixture}/article', '/table', '/js'],
    ['/article$', '/table$', '/js$'].map((v) => ({ kind: 'urlMatches' as const, values: [v] })),
    true,
  ),
  batch(
    'batch-public-pages',
    ['https://example.com/', 'https://www.iana.org/domains/reserved'],
    [
      { kind: 'contains', values: ['Example Domain'] },
      { kind: 'contains', values: ['Reserved'] },
    ],
  ),
]
