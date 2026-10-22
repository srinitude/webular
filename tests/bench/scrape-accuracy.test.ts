// Offline scrape accuracy: every scrape.page task on an HTML fixture runs the
// static main-content path (parsePage, then Markdown of the article, or of the
// whole page when Readability finds none) and is scored on its gold: recall of
// the `with` lines and leak of the `without` boilerplate lines. Script-rendered
// pages (spa, lazy-scroll) score 0 here: the scrape workflow's browser fallback
// renders them, and this path runs no scripts.
import { expect, test } from 'bun:test'
import { Console, Duration, Effect, FileSystem, Schema } from 'effect'
import { htmlToMarkdown, pageBodyHtml, parsePage } from '../../src/lib/html.ts'
import { eff } from '../_support/run.ts'

const root = `${import.meta.dir}/../..`
const norm = (s: string) =>
  s
    .replace(/[\\*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
const SCRIPT_RENDERED = /\/(spa|lazy-scroll)\//

const Gold = Schema.Struct({
  with: Schema.optional(Schema.Array(Schema.String)),
  without: Schema.optional(Schema.Array(Schema.String)),
})
const Row = Schema.fromJsonString(
  Schema.Struct({
    input: Schema.optional(
      Schema.Struct({ kind: Schema.String, path: Schema.optional(Schema.String) }),
    ),
    gold: Schema.optional(Gold),
  }),
)
const decodeRow = Schema.decodeUnknownEffect(Row)

const markdownOf = (html: string, url: string): string =>
  htmlToMarkdown(parsePage(html, url).article.contentHtml || pageBodyHtml(html))

const share = (lines: readonly string[], out: string): number =>
  lines.length ? lines.filter((l) => out.includes(norm(l))).length / lines.length : 0

const scorePage = (fs: FileSystem.FileSystem, path: string, gold: typeof Gold.Type) =>
  Effect.map(fs.readFileString(`${root}/bench/fixtures${path}`), (html) => {
    const out = norm(markdownOf(html, `https://fixture.test${path}`))
    // A blocked page's gold lists no lines to keep, so it counts as full recall.
    const recall = gold.with?.length ? share(gold.with, out) : 1
    return { path, recall, leak: share(gold.without ?? [], out) }
  })

// Pages run one at a time, so the timing reads the extractor, not the scheduler.
test(
  'static scrape keeps every gold line and leaks no boilerplate',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const lines = (yield* fs.readFileString(`${root}/bench/tasks/dev/scrape.jsonl`)).split('\n')
      const decoded = yield* Effect.forEach(lines.filter(Boolean), (l) => decodeRow(l), {
        concurrency: 1,
      })
      const rows = decoded.filter(
        (r) => r.input?.kind === 'scrape.page' && r.input.path?.endsWith('.html'),
      )
      const [took, scores] = yield* Effect.timed(
        Effect.forEach(rows, (r) => scorePage(fs, r.input?.path ?? '', r.gold ?? {}), {
          concurrency: 1,
        }),
      )
      const mean = (k: 'recall' | 'leak') => scores.reduce((a, s) => a + s[k], 0) / scores.length
      const ms = Math.round(Duration.toMillis(took))
      const summary = { rows: rows.length, recall: mean('recall'), leak: mean('leak'), ms }
      yield* Console.log(JSON.stringify(summary))
      expect(rows.length).toBeGreaterThan(40)
      expect(mean('leak')).toBe(0)
      expect(scores.filter((s) => s.recall < 1 && !SCRIPT_RENDERED.test(s.path))).toEqual([])
    }),
  ),
  60_000,
)
