// Timeless: Markdown under plugins/webular states standing facts, with no time-anchored wording.
import { Effect } from 'effect'
import { files, pluginDir, proseLines, read, rel, run } from './lib.ts'

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?'
export const patterns: ReadonlyArray<readonly [string, RegExp]> = [
  ['time word', /\b(currently|now|new|latest|recently|nowadays|these days)\b/i],
  ['time phrase', /\b(as of|will soon|coming soon|used to|no longer)\b/i],
  ['version talk', /\bv\d+\.\d+|\bversion \d+(\.\d+)*\b/i],
  [
    'date in prose',
    new RegExp(
      `\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b${MONTH}\\s+\\d{1,2}(,\\s*\\d{4})?\\b|\\b\\d{1,2}\\s+${MONTH}\\s+\\d{4}\\b`,
    ),
  ],
]

export const findings = (text: string) =>
  proseLines(text).flatMap(({ line, text: t }) => {
    // Code spans and quoted example text are data, not claims about time.
    const bare = t.replace(/`[^`]*`/g, '').replace(/"[^"]*"/g, '')
    return patterns.flatMap(([kind, re]) => {
      const m = re.exec(bare)
      return m ? [{ line, kind, word: m[0] }] : []
    })
  })

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const md = (yield* files(pluginDir)).filter((f) => f.endsWith('.md'))
      const perFile = yield* Effect.forEach(
        md,
        (f) =>
          Effect.map(read(f), (text) =>
            findings(text).map((x) => `${rel(f)}:${x.line}: ${x.kind} "${x.word}"`),
          ),
        { concurrency: 8 },
      )
      return perFile.flat()
    }),
  )
