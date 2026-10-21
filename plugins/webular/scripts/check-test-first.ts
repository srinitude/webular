// Test first: each plugins/webular/src/*.ts has a test file named for it, or a test that imports it.
import { Effect } from 'effect'
import { files, pluginDir, read, rel, run } from './lib.ts'

const base = (p: string) => (p.split('/').pop() ?? p).replace(/\.ts$/, '')

export const untested = (
  sources: ReadonlyArray<string>,
  tests: ReadonlyArray<{ path: string; text: string }>,
) =>
  sources
    .filter((src) => {
      const name = base(src)
      const importRe = new RegExp(`from\\s+['"][^'"]*\\b${name}(\\.ts)?['"]`)
      return !tests.some(
        (t) => base(t.path).replace(/\.test$/, '') === name || importRe.test(t.text),
      )
    })
    .map((src) => `${rel(src)}:1: no test file names ${base(src)} and no test imports it`)

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const sources = (yield* files(`${pluginDir}/src`)).filter((f) => /(?<!\.test)\.ts$/.test(f))
      const testPaths = [
        ...(yield* files(`${pluginDir}/tests`)),
        ...(yield* files(`${pluginDir}/src`)),
      ]
      const tests = yield* Effect.forEach(
        testPaths.filter((f) => /\.test\.ts$/.test(f)),
        (path) => Effect.map(read(path), (text) => ({ path, text })),
        { concurrency: 16 },
      )
      return untested(sources, tests)
    }),
  )
