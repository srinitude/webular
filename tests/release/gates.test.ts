// Release readiness: the Node launcher runs the native package without Bun,
// and the workflow builds before packing, publishes with lifecycle scripts
// off, gates the tag (on main, environment `release`, unpublished version),
// never moves `latest` backwards, waits for npm in parallel, and pushes the
// Homebrew tap and Scoop bucket only when TAP_TOKEN is set.
import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, ManagedRuntime } from 'effect'
import release from '../../.github/workflows/release.yml'
import pkg from '../../package.json'
import { exeName, hostFacts, packageName, type Target, targetFor } from '../../src/core/platform.ts'
import { runProc } from '../../src/core/proc.ts'
import { distTag } from '../../src/release/dist-tag.ts'
import { ROOT } from '../_support/root.ts'

const BUILD_TIMEOUT_MS = 25_000
const runtime = ManagedRuntime.make(BunServices.layer)
afterAll(() => runtime.dispose())

type Step = { name?: string; run?: string; if?: string }
type Job = { 'timeout-minutes': number; environment?: string; if?: string; steps: Step[] }
const jobs = (release as { jobs: Record<string, Job> }).jobs
const runs = (job: string) => jobs[job]?.steps.map((s) => s.run ?? '') ?? []
const at = (job: string, text: string) => runs(job).findIndex((r) => r.includes(text))

// A fake native package that echoes its arguments and exits 7. Windows runs
// no shebang script, so there the fake is a real compiled .exe.
const writeFakeNative = (dir: string, target: Target) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const native = join(dir, 'node_modules', packageName(target))
    yield* fs.makeDirectory(join(native, 'bin'), { recursive: true })
    yield* fs.writeFileString(join(native, 'package.json'), '{"name":"x","version":"0.0.0"}')
    const exe = join(native, 'bin', exeName(target))
    if (target.os !== 'win32') {
      return yield* fs.writeFileString(exe, '#!/bin/sh\necho "native $*"\nexit 7\n', {
        mode: 0o755,
      })
    }
    const source = join(dir, 'fake-native.ts')
    yield* fs.writeFileString(
      source,
      "console.log('native ' + process.argv.slice(2).join(' '))\nprocess.exit(7)\n",
    )
    const compiled = yield* runProc(['bun', 'build', '--compile', source, `--outfile=${exe}`], {
      timeoutMs: BUILD_TIMEOUT_MS,
    })
    expect(compiled.code).toBe(0)
  })

// Lays out a global install in a scoped temp folder:
// node_modules/webular/dist/webular.js plus, when asked, the fake native package.
const install = (withNative: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-launcher-' })
    const launcher = join(dir, 'node_modules', 'webular', 'dist', 'webular.js')
    const built = yield* runProc(
      [
        'bun',
        'build',
        join(ROOT, 'src/release/node-launcher.ts'),
        '--target=node',
        '--format=esm',
        `--outfile=${launcher}`,
      ],
      { timeoutMs: BUILD_TIMEOUT_MS },
    )
    expect(built.code).toBe(0)
    const target = targetFor(yield* hostFacts) as Target
    expect(target).toBeDefined()
    if (withNative) yield* writeFakeNative(dir, target)
    return { launcher, name: packageName(target) }
  })
// Node without Bun on PATH.
const node = Bun.which('node') ?? 'node'
const runLauncher = (launcher: string) =>
  runProc([node, launcher, 'scrape', 'x'], {
    timeoutMs: BUILD_TIMEOUT_MS,
    env: { PATH: '/usr/bin:/bin' },
  })

test(
  'the Node launcher runs the native package with no Bun on PATH',
  () =>
    runtime.runPromise(
      Effect.gen(function* () {
        const { launcher } = yield* install(true)
        const result = yield* runLauncher(launcher)
        expect(result.stdout.trim()).toBe('native scrape x')
        expect(result.code).toBe(7)
      }).pipe(Effect.scoped),
    ),
  30_000,
) // a Windows run compiles the fake .exe first

test('without the native package or Bun, the launcher names the missing package', () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const { launcher, name } = yield* install(false)
      const result = yield* runLauncher(launcher)
      expect(result.code).toBe(1)
      expect(result.stderr).toContain(name)
    }).pipe(Effect.scoped),
  ))

test('the npm bin is the generated Node launcher and ships in the package', () => {
  expect(pkg.bin.webular).toBe('./dist/webular.js')
  expect(pkg.files).toContain('dist/webular.js')
})

test('publish builds before packing and runs no lifecycle scripts', () => {
  const build = at('publish', 'mise run build')
  expect(build).toBeGreaterThan(-1)
  expect(build).toBeLessThan(at('publish', 'gh release download'))
  const publishes =
    runs('publish')
      .join('\n')
      .match(/npm publish[^\n]*/g) ?? []
  expect(publishes.length).toBeGreaterThan(0)
  for (const line of publishes) expect(line).toContain('--ignore-scripts')
})

test('the tag must be on main, unpublished, and publish runs in the release environment', () => {
  expect(runs('test').join('\n')).toContain(
    'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
  )
  expect(runs('test').join('\n')).toMatch(/npm view "webular@\$version" version/)
  expect(jobs['publish']?.environment).toBe('release')
})

test('a stable version below latest never takes latest', () => {
  expect(distTag('0.3.0', '0.2.0')).toBe('latest')
  expect(distTag('0.3.0', '')).toBe('latest')
  expect(distTag('0.2.1', '0.10.0')).toBe('maintenance')
  expect(distTag('0.4.0-rc.1', '0.3.0')).toBe('next')
  expect(runs('publish').join('\n')).toContain('bun src/release/dist-tag.ts')
})

test('the npm waits run in parallel inside the job timeout', () => {
  const script = runs('publish').join('\n')
  expect(script).toMatch(/wait_for "\$spec" &/)
  expect(jobs['publish']?.['timeout-minutes']).toBeGreaterThanOrEqual(20)
})

test('the tap and bucket jobs push only with TAP_TOKEN and only for latest', () => {
  for (const [job, repo] of [
    ['homebrew', 'srinitude/homebrew-webular'],
    ['scoop', 'srinitude/scoop-webular'],
  ] as const) {
    expect(jobs[job]?.if).toContain("needs.publish.outputs.dist-tag == 'latest'")
    const steps = jobs[job]?.steps ?? []
    expect(
      steps.some((s) => s.if === "env.GH_TOKEN == ''" && s.run?.includes('TAP_TOKEN is not set')),
    ).toBe(true)
    expect(steps.some((s) => s.if === "env.GH_TOKEN != ''" && s.run?.includes(repo))).toBe(true)
  }
})
