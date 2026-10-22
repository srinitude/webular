// Every declared package is installed in this checkout's own node_modules at a
// version its range allows. A worktree with no install, or with an install that
// lacks a declared package, resolves imports from a parent folder's
// node_modules and fails with an opaque "Cannot find module".
// Fix: `mise run setup` (bun install --frozen-lockfile) in this checkout.
import { describe, expect } from 'bun:test'
import { Effect, Schema } from 'effect'
import { exists, fileChecks, packageJson, read } from '../_support/repo-files.ts'

const check = fileChecks()
const Installed = Schema.fromJsonString(Schema.Struct({ version: Schema.String }))

const installedVersion = Effect.fn('installedVersion')(function* (name: string) {
  const path = `node_modules/${name}/package.json`
  if (!(yield* exists(path))) return 'missing'
  return (yield* Effect.flatMap(read(path), Schema.decodeUnknownEffect(Installed))).version
})

describe('installed dependencies', () => {
  check(
    "every declared package is in this checkout's node_modules at an allowed version",
    Effect.gen(function* () {
      const { dependencies, devDependencies } = yield* packageJson
      const declared = Object.entries({ ...dependencies, ...devDependencies })
      const installed = yield* Effect.forEach(declared, ([name]) => installedVersion(name), {
        concurrency: 8,
      })
      const wrong = declared
        .map(([name, range], index) => ({ name, range, installed: installed[index] ?? 'missing' }))
        .filter((entry) => !Bun.semver.satisfies(entry.installed, entry.range))
      expect(wrong).toEqual([])
    }),
  )
  // A trusted package runs its install script on every user's machine, and npm
  // ignores the shipped bun.lock there, so a range would run unreviewed code.
  check(
    'every trusted dependency is declared at an exact version',
    Effect.gen(function* () {
      const pkg = yield* packageJson
      const all = { ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.devDependencies }
      const ranged = pkg.trustedDependencies.filter(
        (name) => !/^\d+\.\d+\.\d+$/.test(all[name] ?? ''),
      )
      expect(ranged).toEqual([])
    }),
  )
})
