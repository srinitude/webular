// GitHub Packages: the publish-github-packages job gates on the same tests and
// smoke runs as the npm publish, owns only contents: read and packages: write,
// points setup-node at npm.pkg.github.com under @srinitude with GITHUB_TOKEN,
// and skips versions already there. The rename step, run on the npm/ tree that
// package:platforms really writes, scopes every name and aliases the root's
// platform optionalDependencies, so the Node launcher still finds webular-<key>.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem, Schema } from 'effect'
import release from '../../.github/workflows/release.yml'
import pkg from '../../package.json'
import { assetName, packageName, TARGETS } from '../../src/core/platform.ts'
import {
  GITHUB_REGISTRY,
  manifestPaths,
  SCOPE,
  scopeForGitHub,
} from '../../src/release/github-packages.ts'
import { platformDependencies, writePackage } from '../../src/release/platform-packages.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

type Step = { uses?: string; with?: Record<string, string> }
type Job = { needs: string[]; permissions: Record<string, string>; steps: Step[] }
const jobs = (release as { jobs: Record<string, Job> }).jobs
const job = jobs['publish-github-packages'] as Job
const runs = JSON.stringify(job.steps)

test('the job gates like the npm publish and holds least privilege', () => {
  expect(job.needs).toEqual(jobs['publish']?.needs as string[])
  expect(job.permissions).toEqual({ contents: 'read', packages: 'write', actions: 'read' })
})

test('setup-node targets GitHub Packages under @srinitude with GITHUB_TOKEN only', () => {
  const pin = jobs['publish']?.steps.find((s) => s.uses?.startsWith('actions/setup-node@'))?.uses
  const node = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'))
  expect(node?.uses).toBe(pin as string)
  expect(node?.with?.['registry-url']).toBe(GITHUB_REGISTRY)
  expect(node?.with?.['scope']).toBe(SCOPE)
  expect(runs).toContain('"NODE_AUTH_TOKEN":"$' + '{{ secrets.GITHUB_TOKEN }}"')
  expect(runs).toContain('mise run package:github')
  expect(runs).toContain('npm view')
  expect(runs).not.toContain('--provenance')
})

const version = '9.8.7'
const layOut = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(join(root, 'dist', 'bin'), { recursive: true })
    yield* fs.copyFile(join(ROOT, 'LICENSE'), join(root, 'LICENSE'))
    for (const target of TARGETS)
      yield* fs.writeFileString(join(root, 'dist', 'bin', assetName(target)), 'binary')
    yield* Effect.forEach(TARGETS, (t) => writePackage(root, t, version), {
      concurrency: 4,
      discard: true,
    })
    const deps = { ...pkg.optionalDependencies, ...platformDependencies(version) }
    const manifest = { ...pkg, version, optionalDependencies: deps }
    yield* fs.writeFileString(join(root, 'package.json'), JSON.stringify(manifest))
  })

const Written = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    publishConfig: Schema.Record(Schema.String, Schema.String),
    optionalDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  }),
)

test(
  'every package gets a scoped name, the GitHub registry, and aliased platform deps',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const root = yield* tmpDir('webular-github-packages-')
      yield* layOut(root)
      yield* scopeForGitHub(root)
      const read = (path: string) =>
        Effect.flatMap(fs.readFileString(path), Schema.decodeUnknownEffect(Written))
      const [top, ...platforms] = yield* Effect.forEach(manifestPaths(root), read, {
        concurrency: 4,
      })
      const deps = top?.optionalDependencies ?? {}
      expect(top?.name).toBe(`${SCOPE}/webular`)
      expect(top?.publishConfig).toEqual({ access: 'public', registry: GITHUB_REGISTRY })
      expect(deps['mise']).toBe(pkg.optionalDependencies.mise)
      for (const [i, target] of TARGETS.entries()) {
        const name = packageName(target)
        expect(platforms[i]?.name).toBe(`${SCOPE}/${name}`)
        expect(platforms[i]?.publishConfig).toEqual({ registry: GITHUB_REGISTRY })
        expect(deps[name]).toBe(`npm:${SCOPE}/${name}@${version}`)
      }
    }),
  ),
)
