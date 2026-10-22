// Guard: every tracked Markdown file came out of the readability chain
// (rich-and-native-markdown, then human-language). The chain proves it with a
// row in .markdown-chain/valid.jsonl: the file's path, the sha256 of its
// bytes, and the two stages it went through, in order. A missing row, a row
// for other bytes, or a row without both stages in order fails, so any edit to
// a Markdown file needs a fresh two-stage pass and a fresh row.
// A second guard keeps bare datetime file names, such as
// peers-2026-10-22T15-04-36-833Z.json, out of Markdown prose: readers get link
// text or a label with the date in words; the exact name stays only as a link
// target, in code, or in the path heading every AGENTS.md must carry.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const STAGES = ['readability:rich-and-native-markdown', 'readability:human-language'] as const

const Row = Schema.fromJsonString(
  Schema.Struct({
    path: Schema.String,
    sha: Schema.String,
    stages: Schema.optional(Schema.Array(Schema.String)),
  }),
)

type LedgerRow = {
  readonly path: string
  readonly sha: string
  readonly stages?: ReadonlyArray<string> | undefined
}

const bothStages = (stages: ReadonlyArray<string> | undefined) =>
  stages?.length === STAGES.length && STAGES.every((stage, i) => stages[i] === stage)

const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

// Files whose current hash has no row naming both stages in order, sorted.
const unchained = (
  hashes: ReadonlyArray<readonly [path: string, sha: string]>,
  rows: ReadonlyArray<LedgerRow>,
) => {
  const valid = new Set(
    rows.filter((row) => bothStages(row.stages)).map((row) => `${row.path}\n${row.sha}`),
  )
  return hashes
    .filter(([path, sha]) => !valid.has(`${path}\n${sha}`))
    .map(([path]) => path)
    .sort()
}

const trackedMarkdown = runProc(['git', 'ls-files', '*.md', '*.mdx', '*.markdown'], {
  timeoutMs: 10_000,
  cwd: ROOT,
}).pipe(Effect.map(({ stdout }) => stdout.split('\n').filter(Boolean)))

const ledgerRows = read('.markdown-chain/valid.jsonl').pipe(
  Effect.flatMap((text) =>
    Effect.forEach(
      text.split('\n').filter(Boolean),
      (line) => Schema.decodeUnknownEffect(Row)(line),
      { concurrency: 1 },
    ),
  ),
)

const hashTracked = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = yield* trackedMarkdown
  return yield* Effect.forEach(
    files,
    (path) => Effect.map(fs.readFile(`${ROOT}${path}`), (bytes) => [path, sha256(bytes)] as const),
    { concurrency: 16 },
  )
})

// A date, then a time of at least hours and minutes, joined by T, -, or _.
const DATETIME_NAME = /[\w.-]*\d{4}-\d{2}-\d{2}[T_-]\d{2}-?\d{2}(?:-?\d{2})?[\w.-]*/g

// Prose only: drop fenced code, HTML comments, AGENTS.md path headings, inline
// code, link targets, and reference definitions, so names there pass.
const prose = (markdown: string) =>
  markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^# \S+\/AGENTS\.md$/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)\s]*(?:\s+"[^"]*")?\)/g, ']')
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '')

const bareNames = (markdown: string) => prose(markdown).match(DATETIME_NAME) ?? []

const SAMPLE = [
  'Source: models-2026-10-22-062400-merged.json.',
  'On the run [peers-2026-10-22T14-01-52-746Z.json](bench/x.json), webular led.',
  'See [the peer run from Oct. 22, 2026](bench/peers-2026-10-22T14-01-52-746Z.json).',
  'Run `cat bench/peers-2026-10-22T15-04-36-833Z.json` to read it.',
  '```sh',
  'ls models-2026-10-22-062400-merged.json',
  '```',
  'Dated 2026-10-22 with no time passes.',
  '[run]: bench/models-2026-10-21-111944-30363.json',
  '# tests/models/fixtures/raw/models-2026-10-21-111944-30363/AGENTS.md',
].join('\n')

const namesIn = (path: string) =>
  Effect.map(read(path), (text) => bareNames(text).map((name) => `${path}: ${name}`))

const bareInRepo = Effect.gen(function* () {
  const files = yield* trackedMarkdown
  const found = yield* Effect.forEach(files, namesIn, { concurrency: 16 })
  return { files, found: found.flat() }
})

describe('Markdown chain ledger', () => {
  test('unchained lists missing, stale, and stage-short rows, and only those', () => {
    const rows = [
      { path: 'a.md', sha: 'one', stages: STAGES },
      { path: 'b.md', sha: 'old', stages: STAGES },
      { path: 'd.md', sha: 'd1' },
      { path: 'e.md', sha: 'e1', stages: ['readability:rich-and-native-markdown'] },
      { path: 'f.md', sha: 'f1', stages: [...STAGES].reverse() },
    ]
    const hashes = [
      ['b.md', 'new'],
      ['a.md', 'one'],
      ['c.md', 'x'],
      ['d.md', 'd1'],
      ['e.md', 'e1'],
      ['f.md', 'f1'],
    ] as const
    expect(unchained(hashes, rows)).toEqual(['b.md', 'c.md', 'd.md', 'e.md', 'f.md'])
  })

  test(
    'every tracked Markdown file has a ledger row for its current bytes',
    eff(
      Effect.gen(function* () {
        const [hashes, rows] = yield* Effect.all([hashTracked, ledgerRows], { concurrency: 2 })
        expect(hashes.length).toBeGreaterThan(0)
        expect(unchained(hashes, rows)).toEqual([])
      }),
    ),
    30_000,
  )
})

describe('Markdown datetime file names', () => {
  test('bareNames finds names in prose and link text, and only there', () => {
    expect(bareNames(SAMPLE)).toEqual([
      'models-2026-10-22-062400-merged.json.',
      'peers-2026-10-22T14-01-52-746Z.json',
    ])
  })

  test(
    'no tracked Markdown file shows a bare datetime file name in prose',
    eff(
      Effect.gen(function* () {
        const { files, found } = yield* bareInRepo
        expect(files.length).toBeGreaterThan(0)
        expect(found).toEqual([])
      }),
    ),
    30_000,
  )
})
