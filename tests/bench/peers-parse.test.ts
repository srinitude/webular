// Contract for the parse job: the Firecrawl adapter's request shape, the
// webular adapter saving a served document and parsing the file, and the grade
// a parse task gives (gold text in the parsed output).
import { afterAll, expect, test } from 'bun:test'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect } from 'effect'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { firecrawlParse, webularParse } from '../../scripts/bench/peers/parse-jobs.ts'
import { parseTasks } from '../../scripts/bench/peers/parse-tasks.ts'
import { fail, out } from '../../scripts/bench/peers/peers.ts'
import { parseDocument } from '../../src/lib/parse.ts'
import { recorded } from './replay.ts'

const server = Bun.serve({
  port: 0,
  maxRequestBodySize: 1024,
  fetch: (req) =>
    new URL(req.url).pathname === '/attention.pdf'
      ? new Response(Bun.file('tests/fixtures/driver/attention.pdf'))
      : new Response('gone', { status: 404 }),
})
afterAll(() => {
  void server.stop(true)
})

test('firecrawl parse scrapes the document URL as markdown', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({ success: true, data: { markdown: 'Dummy PDF file' } })
      const call = firecrawlParse(post, 'k').parse
      const o = yield* call ? call({ url: 'https://x.test/a.pdf' }) : Effect.die('no parse')
      expect(seen[0]?.url).toBe('https://api.firecrawl.dev/v2/scrape')
      expect(seen[0]?.headers).toEqual({ authorization: 'Bearer k' })
      expect(seen[0]?.body).toEqual({ url: 'https://x.test/a.pdf', formats: ['markdown'] })
      expect(o.text).toBe('Dummy PDF file')
    }),
  ))

const webular = webularParse((file) =>
  parseDocument(file).pipe(Effect.provide(BunServices.layer), Effect.mapError(fail)),
).parse

test('webular parse saves the served PDF and returns its parsed text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const o = yield* webular
        ? webular({ url: `http://localhost:${server.port}/attention.pdf` })
        : Effect.die('no parse')
      expect(o.text).toContain('scaled dot-product attention')
    }),
  ))

test('webular parse fails on a missing document', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        webular ? webular({ url: `http://localhost:${server.port}/none.pdf` }) : Effect.die('x'),
      )
      expect(exit._tag).toBe('Failure')
    }),
  ))

test('a parse task passes only when the parsed text holds the gold phrase', () => {
  const task = parseTasks[0]
  expect(task?.job).toBe('parse')
  if (!task) return
  expect(answerAccuracy(task, out('A Dummy PDF file', [], 0, 0))).toBe(1)
  expect(answerAccuracy(task, out('Other', [], 0, 0))).toBe(0)
})

test('parse tasks sit on public https documents', () => {
  for (const t of parseTasks) expect(t.input.url?.startsWith('https://')).toBe(true)
})
