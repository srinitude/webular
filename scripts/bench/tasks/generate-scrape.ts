// Builds the scrape family: 150 scrape.page snapshots across 12 page types,
// plus 20 batch.urls jobs of 50 URLs, then writes bench/tasks/<split>/scrape.jsonl.
import { createHash } from 'node:crypto'
import { Effect } from 'effect'
import { runMain } from '../../../src/core/effect.ts'
import { AUTHOR, BUILD_DATE, CANARY, type Task, writeSets } from './generate-common'
import { domainOf } from './generate-scrape-content'
import { type Built, PAGE_TYPES, type PageType, WITHOUT } from './generate-scrape-pages'

const ROOT = `${import.meta.dir}/../../..`
// The first 6 types get 13 tasks and the rest 12: 150 page tasks in all.
const count = (i: number) => (i < 6 ? 13 : 12)

export interface PageTask {
  readonly task: Task
  readonly path: string
  readonly bytes: Uint8Array
}

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

const goldOf = (seed: number, b: Built) => ({
  with: b.with,
  without: b.ext === 'html' ? WITHOUT(seed) : [],
  sha256: sha256(b.bytes),
  metadata: { title: b.title, byline: b.author, date: b.published },
  ...(b.tables ? { tables: b.tables } : {}),
  ...(b.status ? { status: b.status, reason: b.reason } : { status: 'ok' }),
})

const tagsOf = (type: PageType, n: number, seed: number, b: Built) => ({
  domain: domainOf(seed),
  language: b.lang,
  fresh: false,
  longTail: n % 4 === 3,
  pageType: type,
  ...(b.jsLevel ? { jsLevel: b.jsLevel, noJsFloor: true } : {}),
})

const toTask = (type: PageType, n: number, seed: number, b: Built): PageTask => {
  const id = `scrape-page-${type}-${String(n).padStart(2, '0')}`
  const path = `/pages/${type}/${id}.${b.ext}`
  const task: Task = {
    id,
    family: 'scrape',
    input: { kind: 'scrape.page', path, format: 'markdown' },
    gold: goldOf(seed, b),
    aliases: [b.title, id],
    source: {
      url: `fixture://pages/${type}/${id}.${b.ext}`,
      asOf: BUILD_DATE,
      license: 'original',
    },
    author: AUTHOR,
    buildDate: BUILD_DATE,
    questionType: 'scrape.page',
    tags: tagsOf(type, n, seed, b),
    canary: CANARY,
  }
  return { task, path, bytes: b.bytes }
}

export const buildPages = (): ReadonlyArray<PageTask> =>
  (Object.keys(PAGE_TYPES) as PageType[]).flatMap((type, ti) =>
    Array.from({ length: count(ti) }, (_, n) => {
      const seed = ti * 101 + n * 7 + 3
      return toTask(type, n, seed, PAGE_TYPES[type](seed))
    }),
  )

type UrlGold = {
  readonly path: string
  readonly expect: 'ok' | 'dead' | 'redirect' | 'blocked'
  readonly finalPath?: string
}

// Each job mixes 40 live pages with 4 dead links, 4 redirects, and 2 blocked pages.
const jobUrls = (pages: ReadonlyArray<PageTask>, j: number): ReadonlyArray<UrlGold> => {
  const live = pages.filter((p) => p.task.gold['status'] === 'ok')
  const blocked = pages.filter((p) => p.task.gold['status'] === 'blocked')
  const at = (xs: ReadonlyArray<PageTask>, k: number) =>
    xs[(j * 37 + k * 11) % xs.length]?.path ?? ''
  return [
    ...Array.from({ length: 40 }, (_, k) => ({ path: at(live, k), expect: 'ok' as const })),
    ...Array.from({ length: 4 }, (_, k) => ({
      path: `/gone/job-${j}/missing-${k}.html`,
      expect: 'dead' as const,
    })),
    ...Array.from({ length: 4 }, (_, k) => ({
      path: `/r${at(live, k + 50)}`,
      expect: 'redirect' as const,
      finalPath: at(live, k + 50),
    })),
    ...Array.from({ length: 2 }, (_, k) => ({ path: at(blocked, k), expect: 'blocked' as const })),
  ]
}

const batchJob = (pages: ReadonlyArray<PageTask>, j: number): Task => {
  const id = `scrape-batch-${String(j).padStart(2, '0')}`
  const urls = jobUrls(pages, j)
  return {
    id,
    family: 'scrape',
    input: { kind: 'batch.urls', paths: urls.map((u) => u.path) },
    gold: { urls, okCount: 40 },
    aliases: [id],
    source: { url: `fixture://batch/${id}`, asOf: BUILD_DATE, license: 'original' },
    author: AUTHOR,
    buildDate: BUILD_DATE,
    questionType: 'batch.urls',
    tags: {
      domain: 'mixed',
      language: 'en',
      fresh: false,
      longTail: j % 5 === 4,
      pageType: 'batch',
    },
    canary: CANARY,
  }
}

export const buildBatch = (pages: ReadonlyArray<PageTask>) =>
  Array.from({ length: 20 }, (_, j) => batchJob(pages, j))

export const generate = (root = ROOT) =>
  Effect.gen(function* () {
    const pages = buildPages()
    yield* Effect.forEach(
      pages,
      (p) => Effect.tryPromise(() => Bun.write(`${root}/bench/fixtures${p.path}`, p.bytes)),
      { concurrency: 16, discard: true },
    )
    yield* writeSets(root, 'scrape', [...pages.map((p) => p.task), ...buildBatch(pages)])
    yield* Effect.logInfo(`scrape: ${pages.length} pages and 20 batch jobs`)
    return 0
  })

if (import.meta.main) runMain(generate())
