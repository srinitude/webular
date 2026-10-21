// Guard: webular holds only TypeScript. It fails on any tracked .js, .mjs, or
// .cjs file outside build output, and on any inline `bun -e` or `node -e`
// script in mise.toml, package.json, or the GitHub workflows.

import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { ROOT } from '../_support/root.ts'

const JS_FILE = /\.(js|mjs|cjs)$/
const BUILD_OUTPUT = /^(node_modules|dist|out|coverage|\.deepsec)\//
const INLINE_JS = /\b(bun|node)\s+(-e|-p|--eval|--print)\b/
const LS_FILES = ['ls-files', '--cached', '--others', '--exclude-standard']

const repoFiles = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  return yield* spawner.lines(ChildProcess.make('git', LS_FILES, { cwd: ROOT }))
})

const configTexts = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const workflows = (yield* fs.readDirectory(`${ROOT}.github/workflows`))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `.github/workflows/${name}`)
  return yield* Effect.forEach(
    ['mise.toml', 'package.json', ...workflows],
    (path) => fs.readFileString(`${ROOT}${path}`).pipe(Effect.map((text) => ({ path, text }))),
    { concurrency: 4 },
  )
})

describe('only TypeScript source', () => {
  test('the inline-script pattern catches the old clean task and passes its replacement', () => {
    expect(INLINE_JS.test(`bun -e "require('node:fs').rmSync('dist')"`)).toBe(true)
    expect(INLINE_JS.test('bun scripts/clean.ts')).toBe(false)
  })

  test('no .js, .mjs, or .cjs file outside build output', () =>
    Effect.runPromise(
      repoFiles.pipe(
        Effect.map((files) => files.filter((f) => JS_FILE.test(f) && !BUILD_OUTPUT.test(f))),
        Effect.map((jsFiles) => expect(jsFiles).toEqual([])),
        Effect.scoped,
        Effect.provide(BunServices.layer),
      ),
    ))

  test('no bun -e or node -e in mise.toml, package.json, or workflows', () =>
    Effect.runPromise(
      configTexts.pipe(
        Effect.map((texts) => texts.filter(({ text }) => INLINE_JS.test(text))),
        Effect.map((hits) => expect(hits.map(({ path }) => path)).toEqual([])),
        Effect.provide(BunServices.layer),
      ),
    ))
})
