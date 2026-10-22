// Guard: every Jev request names one model, JEV_LATEST_RELEASED in
// src/lib/jev/model.ts. No other versioned Jev id appears in src or plugins, and
// no quoted alias or preview name appears outside the lints that refuse them.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { isReleasedModel, JEV_LATEST_RELEASED } from '../../src/lib/jev/model.ts'
import { eff } from '../_support/run.ts'

const VERSIONED = /jev-\d+\.\d+\.\d+/
const ALIAS = /['"`]jev-(latest|preview)['"`]/
const MODEL_HOME = 'src/lib/jev/model.ts'
const ALIAS_HOMES = new Set([
  'src/lib/jev/learn/lint.ts',
  'src/lib/jev/learn/definition-lint.ts',
  'src/lib/jev/define.ts',
])
const ROOT = `${import.meta.dir}/../..`
const CODE = /\.(ts|tsx|js|mjs|json|toml|ya?ml)$/

const hitsIn = (dir: string, bad: (path: string, line: string) => boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const files = (yield* fs.readDirectory(`${ROOT}/${dir}`, { recursive: true })).filter(
      (f) => CODE.test(f) && !f.includes('node_modules'),
    )
    const hits: string[] = []
    for (const f of files) {
      const path = `${dir}/${f}`
      const lines = (yield* fs.readFileString(`${ROOT}/${path}`)).split('\n')
      hits.push(...lines.flatMap((line, i) => (bad(path, line) ? [`${path}:${i + 1}`] : [])))
    }
    return hits
  })

const scan = (bad: (path: string, line: string) => boolean) =>
  eff(
    Effect.gen(function* () {
      const src = yield* hitsIn('src', bad)
      const plugins = yield* hitsIn('plugins', bad)
      expect([...src, ...plugins]).toEqual([])
    }),
  )

test('the pinned model is a released, versioned id', () => {
  expect(isReleasedModel(JEV_LATEST_RELEASED)).toBe(true)
  for (const name of ['jev-latest', 'jev-preview', 'jev', 'jev-1.14'])
    expect(isReleasedModel(name)).toBe(false)
})

// The standalone plugin keeps one mirror line, which must equal the constant.
const PLUGIN_MIRROR = 'plugins/webular/evals/jev.ts'
const mirrorLine = `const JEV_LATEST_RELEASED = '${JEV_LATEST_RELEASED}'`

test(
  'no other versioned Jev id appears in src or plugins',
  scan(
    (path, line) =>
      path !== MODEL_HOME &&
      VERSIONED.test(line) &&
      !(path === PLUGIN_MIRROR && line === mirrorLine),
  ),
)

test(
  'no quoted Jev alias or preview name appears outside the lints',
  scan((path, line) => path !== MODEL_HOME && !ALIAS_HOMES.has(path) && ALIAS.test(line)),
)
