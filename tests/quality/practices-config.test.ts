// Best-practices gate (docs/best-practices.md): CI workflow and package metadata.
import { describe, expect } from 'bun:test'
import { Effect } from 'effect'
import { exists, fileChecks, packageJson, read } from '../_support/repo-files.ts'

const check = fileChecks()

const workflow = read('.github/workflows/ci.yml')

describe('best practices: CI workflow', () => {
  check(
    'every action is pinned to a full commit SHA',
    Effect.map(workflow, (yml) => {
      const uses = [...yml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1] ?? '')
      expect(uses.length).toBeGreaterThan(0)
      for (const ref of uses) expect(ref).toMatch(/@[0-9a-f]{40}$/)
    }),
  )
  check(
    'token is read-only, not persisted, and the job has a timeout',
    Effect.map(workflow, (yml) => {
      expect(yml).toMatch(/permissions:\s*\n\s+contents: read/)
      expect(yml).toContain('persist-credentials: false')
      expect(yml).toMatch(/timeout-minutes: \d+/)
      expect(yml).not.toContain('pull_request_target')
    }),
  )
  check(
    'mise installs only what mise.lock records, for every CI platform',
    Effect.gen(function* () {
      expect(yield* read('mise.toml')).toMatch(/^\[settings\]\s+lockfile = true$/m)
      const lock = yield* read('mise.lock')
      for (const platform of ['linux-x64', 'macos-arm64', 'windows-x64']) {
        expect(lock).toContain(`[tools.bun."platforms.${platform}"]`)
      }
      expect(yield* workflow).toMatch(/^\s+MISE_LOCKED: 1$/m)
    }),
  )
  check(
    'dependabot keeps action and npm pins current',
    Effect.map(read('.github/dependabot.yml'), (yml) => {
      expect(yml).toContain('package-ecosystem: github-actions')
      expect(yml).toContain('package-ecosystem: bun')
    }),
  )
})

describe('best practices: package engines and files', () => {
  check(
    'engines.bun matches the mise bun pin',
    Effect.gen(function* () {
      const pin = (yield* read('mise.toml')).match(/^bun = "([^"]+)"/m)?.[1]
      expect((yield* packageJson).engines['bun']).toBe(`>=${pin}`)
    }),
  )
  check(
    'every path in files exists and CHANGELOG.md ships',
    Effect.gen(function* () {
      const { files } = yield* packageJson
      expect(files).toContain('CHANGELOG.md')
      // dist/ is build output: the build task must write each dist entry, and
      // once dist/ is built (`mise run test` builds first) each entry must exist.
      const build =
        (yield* read('mise.toml')).match(/^\[tasks\.build\]$[\s\S]*?(?=^\[)/m)?.[0] ?? ''
      const built = yield* exists('dist')
      const unwritten = files.filter(
        (path) =>
          path.startsWith('dist/') &&
          [`/${path}"`, `"${path}/`, `--chunk-naming=${path.slice(5)}/`].every(
            (s) => !build.includes(s),
          ),
      )
      const checked = files.filter((path) => built || !path.startsWith('dist/'))
      const found = yield* Effect.forEach(checked, exists, { concurrency: 8 })
      const missing = checked.filter((_, index) => !found[index])
      expect({ unwritten, missing }).toEqual({ unwritten: [], missing: [] })
    }),
  )
})

describe('best practices: package dependencies', () => {
  check(
    'no @types package for a library that ships its own types',
    Effect.map(packageJson, ({ devDependencies }) => {
      for (const name of ['diff', 'effect', 'zod', 'mammoth', 'mozilla__readability']) {
        expect(Object.keys(devDependencies)).not.toContain(`@types/${name}`)
      }
    }),
  )
  check(
    'effect packages share one exact version',
    Effect.map(packageJson, ({ dependencies, devDependencies }) => {
      expect(dependencies['effect']).toMatch(/^\d+\.\d+\.\d+$/)
      // bin/webular.ts runs @effect/platform-bun after install, so it ships as a dependency.
      expect(dependencies['@effect/platform-bun']).toBe(dependencies['effect'])
      expect(Object.keys(devDependencies)).not.toContain('@effect/platform-bun')
    }),
  )
})

describe('best practices: supply chain', () => {
  check(
    'bunfig.toml sets a minimumReleaseAge of at least one day',
    Effect.map(read('bunfig.toml'), (toml) => {
      const age = Number(toml.match(/^minimumReleaseAge\s*=\s*(\d+)/m)?.[1])
      expect(age).toBeGreaterThanOrEqual(86400)
    }),
  )
})
