// Writes the crawl.map fixture sites under bench/fixtures/sites/<name>/ and the
// crawl tasks through writeSets. Run: bun scripts/bench/tasks/generate-crawl.ts
import { createHash } from 'node:crypto'
import { BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'
import { AUTHOR, BUILD_DATE, CANARY, type Task, writeSets } from './generate-common'
import { files } from './generate-crawl-files'
import { SITES, type Site } from './generate-crawl-model'

const task = (site: Site): Task => ({
  id: `crawl.map.${site.name}`,
  family: 'crawl',
  input: { siteRoot: `/sites/${site.name}`, startPath: '/index.html', limits: site.limits },
  gold: {
    urls: site.gold,
    sha256: createHash('sha256').update(site.gold.join('\n')).digest('hex'),
  },
  aliases: [],
  source: { url: `/sites/${site.name}/index.html`, asOf: BUILD_DATE, license: 'original' },
  author: AUTHOR,
  buildDate: BUILD_DATE,
  questionType: 'crawl.map',
  tags: {
    domain: site.domain,
    language: site.language,
    fresh: false,
    longTail: true,
    size: site.size,
    sitemap: site.sitemap,
    scope: site.scope,
  },
  canary: CANARY,
})

export const TASKS: ReadonlyArray<Task> = SITES.map(task)

const writeSite = (root: string, site: Site) =>
  Effect.forEach(
    files(site),
    ([path, body]) =>
      Effect.tryPromise(() => Bun.write(`${root}/bench/fixtures/sites/${site.name}${path}`, body)),
    { concurrency: 32, discard: true },
  )

export const generate = (root: string) =>
  Effect.gen(function* () {
    yield* Effect.forEach(SITES, (s) => writeSite(root, s), { concurrency: 2, discard: true })
    yield* writeSets(root, 'crawl', TASKS)
  })

if (import.meta.main) BunRuntime.runMain(generate(process.cwd()))
