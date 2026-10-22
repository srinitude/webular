// Guard: every AGENTS.md stays in sync with the repo. Beyond agents-md.test.ts
// (coverage, shape, size caps, tasks, slash paths) and markdown-links.test.ts
// (the docs:links task): backticked file names exist, the entries of a folder
// are named, env vars, flags, commands, and symbols exist in code, and only the
// Jev key is named as a usable key.
import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import {
  claims,
  codeDrift,
  type Doc,
  keyDrift,
  missingFileNames,
  readDocs,
  unnamed,
} from '../_support/agents-sync.ts'
import { read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const tracked = runProc(['git', 'ls-files', '--cached'], {
  timeoutMs: 10_000,
  cwd: ROOT,
}).pipe(Effect.map(({ stdout }) => stdout.split('\n').filter(Boolean)))

const loaded = Effect.gen(function* () {
  const files = yield* tracked
  const docs = yield* readDocs(files.filter((f) => f.endsWith('AGENTS.md')))
  return { files, docs }
})

const Gaps = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Number))

const baseName = (f: string) => f.split('/').pop() ?? f

describe('AGENTS.md sync', () => {
  test(
    'every backticked file name is a tracked file',
    eff(
      Effect.map(loaded, ({ files, docs }) => {
        const names = new Set(files.map(baseName))
        expect(docs.flatMap((d) => missingFileNames(d, names))).toEqual([])
      }),
    ),
    30_000,
  )

  // ponytail: a folder may grow no further than its recorded count of unnamed entries; naming
  // them all in its AGENTS.md is the upgrade, and lowering the count in agents-md-gaps.json
  // keeps the gain. Per-folder counts catch new drift but not a swap of one entry for another.
  test(
    'a folder names no fewer entries than its recorded floor',
    eff(
      Effect.gen(function* () {
        const { files, docs } = yield* loaded
        const known = yield* Effect.flatMap(
          read('tests/quality/agents-md-gaps.json'),
          Schema.decodeUnknownEffect(Gaps),
        )
        const over = docs.flatMap((d) => {
          const n = unnamed(d, files).length
          const cap = known[d.path] ?? 0
          return n > cap ? [`${d.path}: ${n} unnamed entries > ${cap}`] : []
        })
        expect(over).toEqual([])
      }),
    ),
    30_000,
  )

  test(
    'env vars, flags, commands, and symbols named in a doc exist in the code',
    eff(
      Effect.gen(function* () {
        const { files, docs } = yield* loaded
        const commands = new Set(
          files
            .filter((f) => /^src\/commands\/[\w-]+\.ts$/.test(f))
            .map((f) => baseName(f).slice(0, -3)),
        )
        expect(yield* codeDrift(docs, commands)).toEqual([])
      }),
    ),
    60_000,
  )

  test(
    'only the Jev key is named as a usable key',
    eff(Effect.map(loaded, ({ docs }) => expect(docs.flatMap(keyDrift)).toEqual([]))),
    30_000,
  )

  test('the analyzers catch planted drift', () => {
    const doc: Doc = {
      dir: 'src',
      path: 'src/AGENTS.md',
      text: '`BRAVE_API_KEY` and Brave\n`--nope` `fooBar()` `webular zap` `gone.ts`',
    }
    expect(keyDrift(doc)).toHaveLength(2)
    expect(missingFileNames(doc, new Set())).toEqual([
      'src/AGENTS.md: no tracked file named gone.ts',
    ])
    expect(unnamed(doc, ['src/a.ts', 'src/AGENTS.md', 'src/sub/x.ts'])).toEqual(['a.ts', 'sub/'])
    const c = claims(doc.text)
    expect([c.flags, c.symbols, c.commands]).toEqual([['--nope'], ['fooBar'], ['zap']])
  })
})
