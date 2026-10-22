// The generated task sets load through the core loader: every dev and test
// file is in bench/tasks/manifest.json, decodes as SetTask lines with the
// canary, and one edited byte makes the loader refuse the file.
import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { loadSetFile } from '../../scripts/bench/loader.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

// Resolved, not `${dir}/../..`: Bun's copyFile on Windows does not collapse
// `..` in a mixed-separator path and fails with ENOENT.
const DIR = resolve(import.meta.dir, '../../bench/tasks')
const NAMES = [...new Bun.Glob('{dev,test}/*.jsonl').scanSync({ cwd: DIR })].map((n) =>
  n.replaceAll('\\', '/'),
)

test(
  'every committed set file loads with its canary and split',
  eff(
    Effect.gen(function* () {
      expect(NAMES.length).toBeGreaterThan(0)
      for (const name of NAMES) {
        const { tasks } = yield* loadSetFile(DIR, name)
        expect(tasks.length).toBeGreaterThan(0)
        expect(tasks.every((t) => name.startsWith(`${t.split}/`))).toBe(true)
      }
    }),
  ),
  60000,
)

test(
  'an edited set file is refused',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('set-loader-')
      yield* fs.makeDirectory(`${dir}/dev`)
      yield* fs.copyFile(`${DIR}/manifest.json`, `${dir}/manifest.json`)
      const text = yield* fs.readFileString(`${DIR}/dev/crawl.jsonl`)
      yield* fs.writeFileString(`${dir}/dev/crawl.jsonl`, `${text} `)
      expect(yield* failMsg(loadSetFile(dir, 'dev/crawl.jsonl'))).toContain('sha256 differs')
    }),
  ),
)

test(
  'the dev scrape set marks its three robots-blocked pages with expect',
  eff(
    Effect.gen(function* () {
      const { tasks } = yield* loadSetFile(DIR, 'dev/scrape.jsonl')
      const robots = tasks.filter((t) => t.expect !== undefined)
      expect(robots.map((t) => t.id)).toEqual([
        'scrape-page-blocked-02',
        'scrape-page-blocked-06',
        'scrape-page-blocked-10',
      ])
      for (const t of robots) expect(t.expect).toEqual({ status: 'blocked', reason: 'robots' })
    }),
  ),
)
