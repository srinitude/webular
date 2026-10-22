// Contract for the batch job: each rival's request shape and Output, the
// webular arm against a local fixture, and the per-URL grade a batch task gives.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import {
  batchTargets,
  exaBatch,
  firecrawlBatch,
  pagesOut,
  tavilyBatch,
} from '../../scripts/bench/peers/batch-jobs.ts'
import { batchTasks } from '../../scripts/bench/peers/batch-tasks.ts'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import type { Output, Provider } from '../../scripts/bench/peers/model.ts'
import { webular } from '../../scripts/bench/peers/providers.ts'
import { useFixture } from '../_support/fixture.ts'
import { recorded } from './replay.ts'

const call = (jobs: Provider['jobs'], url: string) => {
  const job = jobs.batch
  return job ? job({ url }) : Effect.die('no batch job')
}
// One grade per task with this id: [1] passed, [0] failed, [] no such task.
const grade = (id: string, out: Output) =>
  batchTasks.filter((t) => t.id === id).map((t) => answerAccuracy(t, out))

test('a batch input is comma-joined URLs, later paths resolved against the first', () => {
  expect(batchTargets('https://example.com/,/about,https://other.test/x')).toEqual([
    'https://example.com/',
    'https://example.com/about',
    'https://other.test/x',
  ])
})

test('firecrawl posts every URL to batch/scrape, polls until completed, and maps markdown', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({ success: true, id: 'job1', url: 'u' })
      const client = HttpClient.make((req, url) => {
        seen.push({ url: url.toString(), headers: { ...req.headers } })
        const body = {
          status: 'completed',
          data: [{ markdown: '# Example Domain', metadata: { sourceURL: 'https://example.com/' } }],
        }
        return Effect.succeed(HttpClientResponse.fromWeb(req, new Response(JSON.stringify(body))))
      })
      const o = yield* call(firecrawlBatch(post, 'k', client), 'https://example.com/,/about')
      expect(seen[0]?.url).toBe('https://api.firecrawl.dev/v2/batch/scrape')
      expect(seen[0]?.body).toEqual({
        urls: ['https://example.com/', 'https://example.com/about'],
        formats: ['markdown'],
      })
      expect(seen[1]?.url).toBe('https://api.firecrawl.dev/v2/batch/scrape/job1')
      expect(seen[1]?.headers['authorization']).toBe('Bearer k')
      expect(o.urls).toEqual(['https://example.com/'])
      expect(o.text).toContain('Example Domain')
      expect(o.costUsd).toBeCloseTo((2 * 83) / 100_000)
    }),
  ))

test('firecrawl fails a batch that ends in any status but completed', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post } = recorded({ success: true, id: 'job1', url: 'u' })
      const client = HttpClient.make((req) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(req, new Response(JSON.stringify({ status: 'failed' }))),
        ),
      )
      const r = yield* Effect.result(call(firecrawlBatch(post, 'k', client), 'https://a.test/'))
      expect(r._tag).toBe('Failure')
    }),
  ))

test('exa posts one /contents call with every URL and counts only pages with text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({
        results: [
          { url: 'https://a.test/', text: 'alpha' },
          { url: 'https://b.test/', text: '' },
        ],
        costDollars: { total: 0.002 },
      })
      const o = yield* call(exaBatch(post, 'k'), 'https://a.test/,https://b.test/')
      expect(seen[0]?.url).toBe('https://api.exa.ai/contents')
      expect(seen[0]?.headers).toEqual({ 'x-api-key': 'k' })
      expect(seen[0]?.body).toEqual({ urls: ['https://a.test/', 'https://b.test/'], text: true })
      expect(o.urls).toEqual(['https://a.test/'])
      expect(o.costUsd).toBe(0.002)
    }),
  ))

test('tavily posts one /extract call with every URL and bills a credit per 5 pages', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({
        results: [{ url: 'https://a.test/', raw_content: 'alpha' }],
        failed_results: [],
      })
      const o = yield* call(tavilyBatch(post, 'k'), 'https://a.test/,https://b.test/')
      expect(seen[0]?.url).toBe('https://api.tavily.com/extract')
      expect(seen[0]?.body).toEqual({
        urls: ['https://a.test/', 'https://b.test/'],
        format: 'markdown',
      })
      expect(o.costUsd).toBe(0.008)
      expect(o.text).toBe('https://a.test/\nalpha')
    }),
  ))

test('a batch task passes only when every URL is scraped', () => {
  const page = (url: string, text: string) => ({ url, text })
  const both = pagesOut(
    [
      page('https://example.com/', 'Example Domain'),
      page('https://www.iana.org/domains/reserved', 'Reserved Domains'),
    ],
    0,
    0,
  )
  const one = pagesOut([page('https://example.com/', 'Example Domain')], 0, 0)
  expect(grade('batch-public-pages', both)).toEqual([1])
  expect(grade('batch-public-pages', one)).toEqual([0])
  const local = (paths: string[]) =>
    pagesOut(
      paths.map((p) => page(`http://127.0.0.1:1${p}`, 'Fixture')),
      0,
      0,
    )
  expect(grade('batch-fixture-pages', local(['/article', '/table', '/js']))).toEqual([1])
  expect(grade('batch-fixture-pages', local(['/article', '/table']))).toEqual([0])
  expect(batchTasks.filter((t) => t.localOnly).map((t) => t.id)).toEqual(['batch-fixture-pages'])
})

const fixture = useFixture(() => {
  const page = (title: string) => () =>
    new Response(
      `<!doctype html><html><head><title>${title}</title></head><body><p>${title}</p></body></html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  return { '/a': page('Alpha Page'), '/b': page('Beta Page') }
})

test('webular batch scrapes each fixture URL and drops the page that is missing', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const o = yield* call(webular.jobs, `${fixture.origin}/a,/b,/missing`)
      expect(o.urls).toEqual([`${fixture.origin}/a`, `${fixture.origin}/b`])
      expect(o.text).toContain('Alpha Page')
      expect(o.text).toContain('Beta Page')
    }),
  ))
