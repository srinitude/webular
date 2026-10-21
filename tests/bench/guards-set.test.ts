// Guard tests 1-6 (spec-integrity-and-report.md, "Set, cache, and run rules"):
// each one plants its bias and expects the loader, quota check, or leak check
// to refuse it. One clean fixture set passes all three.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { findLeaks, leakNeedles } from '../../scripts/bench/leak.ts'
import { loadTaskFile, sha256 } from '../../scripts/bench/loader.ts'
import { quotaBreaks } from '../../scripts/bench/quotas.ts'
import type { Task, TaskFile } from '../../scripts/bench/schema.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

const FIX = `${import.meta.dir}/fixtures/set`
const clean = Effect.orDie(loadTaskFile(FIX, 'set.json'))

// Writes set.json plus a manifest.json that holds its true hash.
const freeze = (text: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* tmpDir('guards-set-')
    yield* fs.writeFileString(`${dir}/set.json`, text)
    const manifest = { version: 'fixture-set-1', files: { 'set.json': sha256(text) } }
    yield* fs.writeFileString(`${dir}/manifest.json`, JSON.stringify(manifest))
    return dir
  })

const withFirst = (file: TaskFile, edit: (t: Task) => Task) =>
  JSON.stringify({ ...file, tasks: file.tasks.map((t, i) => (i === 0 ? edit(t) : t)) })

// The refusal message for a set whose first task got one edit.
const refusal = (edit: (t: Task) => Task) =>
  Effect.gen(function* () {
    const dir = yield* freeze(withFirst(yield* clean, edit))
    return yield* failMsg(loadTaskFile(dir, 'set.json'))
  })

test(
  'a clean frozen set loads, meets every quota, and leaks nothing',
  eff(
    Effect.gen(function* () {
      const file = yield* clean
      expect(file.tasks.length).toBe(10)
      expect(quotaBreaks(file.tasks)).toEqual([])
      const fs = yield* FileSystem.FileSystem
      const src = yield* tmpDir('guards-src-')
      yield* fs.writeFileString(`${src}/ok.ts`, 'export const ok = 1\n')
      expect(yield* findLeaks(src, leakNeedles(file))).toEqual([])
    }),
  ),
)

test(
  'guard 1: a manifest hash that does not match is refused',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* freeze(JSON.stringify(yield* clean))
      const wrong = { version: 'fixture-set-1', files: { 'set.json': '0'.repeat(64) } }
      yield* fs.writeFileString(`${dir}/manifest.json`, JSON.stringify(wrong))
      expect(yield* failMsg(loadTaskFile(dir, 'set.json'))).toContain('sha256 differs')
    }),
  ),
)

test(
  'guard 2: a task file edited after the freeze, unfrozen, or without a canary is refused',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const file = yield* clean
      const dir = yield* freeze(JSON.stringify(file))
      yield* fs.writeFileString(
        `${dir}/set.json`,
        withFirst(file, (t) => ({ ...t, input: 'x' })),
      )
      expect(yield* failMsg(loadTaskFile(dir, 'set.json'))).toContain('sha256 differs')
      const thawed = yield* freeze(JSON.stringify({ ...file, frozen: false }))
      expect(yield* failMsg(loadTaskFile(thawed, 'set.json'))).toContain('not frozen')
      const { canary: _, ...bare } = file
      const noCanary = yield* freeze(JSON.stringify(bare))
      expect(yield* failMsg(loadTaskFile(noCanary, 'set.json'))).toContain('canary')
    }),
  ),
)

test(
  'guard 3: a broken diversity quota is reported',
  eff(
    Effect.gen(function* () {
      const { tasks } = yield* clean
      const retag = (tags: Partial<Task['tags']>) =>
        quotaBreaks(tasks.map((t) => ({ ...t, tags: { ...t.tags, ...tags } }))).join()
      expect(retag({ domain: 'science' })).toContain('domains')
      expect(retag({ navigational: true })).toContain('navigational')
      expect(retag({ language: 'en' })).toContain('non-English')
      expect(retag({ fresh: false })).toContain('fresh')
      expect(retag({ longTail: false })).toContain('long-tail')
      expect(retag({ premise: 'true' })).toContain('premise')
    }),
  ),
)

test(
  'guard 4: a task with no grader, an empty check, or empty tags is refused',
  eff(
    Effect.gen(function* () {
      const noGrader = yield* refusal((t) => ({ ...t, checks: [] }))
      expect(noGrader).toContain('no check and no rubric')
      const empty = yield* refusal((t) => ({ ...t, checks: [{ kind: 'contains', value: ' ' }] }))
      expect(empty).toContain('empty check')
      const noDomain = yield* refusal((t) => ({ ...t, tags: { ...t.tags, domain: '' } }))
      expect(noDomain).toContain('empty tags.domain')
    }),
  ),
)

test(
  'guard 5: gold without source, aliases, or an ISO asOf is refused',
  eff(
    Effect.gen(function* () {
      expect(yield* refusal((t) => ({ ...t, source: '' }))).toContain('no source')
      expect(yield* refusal((t) => ({ ...t, aliases: [] }))).toContain('no aliases')
      expect(yield* refusal((t) => ({ ...t, asOf: '09/01/2026' }))).toContain('not ISO')
      expect(yield* refusal((t) => ({ ...t, asOf: '2026-02-30' }))).toContain('not ISO')
    }),
  ),
)

test(
  'guard 6: a canary or sealed input planted in a source dir is found',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const file = yield* clean
      const src = yield* tmpDir('guards-src-')
      yield* fs.makeDirectory(`${src}/nested`)
      yield* fs.writeFileString(`${src}/a.ts`, `// ${file.canary}\n`)
      const sealed = file.tasks.find((t) => t.split === 'sealed')?.input ?? ''
      yield* fs.writeFileString(`${src}/nested/b.ts`, `const q = '${sealed}'\n`)
      expect((yield* findLeaks(src, leakNeedles(file))).length).toBe(2)
    }),
  ),
)
