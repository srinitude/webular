// Guard: every tracked Markdown file came out of the readability chain
// (rich-and-native-markdown, then human-language). The chain proves it with a
// row in .markdown-chain/valid.jsonl: the file's path and the sha256 of its
// bytes. A missing row or a row for other bytes fails, so any edit to a
// Markdown file needs a fresh chain pass and a fresh row.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const Row = Schema.fromJsonString(Schema.Struct({ path: Schema.String, sha: Schema.String }))

const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

// Files whose current hash has no matching row, sorted.
const unchained = (
  hashes: ReadonlyArray<readonly [path: string, sha: string]>,
  rows: ReadonlyArray<{ readonly path: string; readonly sha: string }>,
) => {
  const valid = new Set(rows.map((row) => `${row.path}\n${row.sha}`))
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
      {
        concurrency: 1,
      },
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

describe('Markdown chain ledger', () => {
  test('unchained lists missing and stale rows, and only those', () => {
    const rows = [
      { path: 'a.md', sha: 'one' },
      { path: 'b.md', sha: 'old' },
    ]
    const hashes = [
      ['b.md', 'new'],
      ['a.md', 'one'],
      ['c.md', 'x'],
    ] as const
    expect(unchained(hashes, rows)).toEqual(['b.md', 'c.md'])
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
