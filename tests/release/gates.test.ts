// Release readiness: the Node launcher runs the native package without Bun,
// and the workflow builds before packing, publishes with lifecycle scripts
// off, gates the tag (on main, environment `release`, unpublished version),
// never moves `latest` backwards, waits for npm in parallel, and pushes the
// Homebrew tap and Scoop bucket only when TAP_TOKEN is set.
import { afterAll, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { ManagedRuntime } from 'effect'
import release from '../../.github/workflows/release.yml'
import pkg from '../../package.json'
import { exeName, hostFacts, packageName, type Target, targetFor } from '../../src/core/platform.ts'
import { distTag } from '../../src/release/dist-tag.ts'
import { ROOT } from '../_support/root.ts'

const runtime = ManagedRuntime.make(BunServices.layer)
const tmp = mkdtempSync(join(tmpdir(), 'webular-launcher-'))
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true })
  return runtime.dispose()
})

type Step = { name?: string; run?: string; if?: string }
type Job = { 'timeout-minutes': number; environment?: string; if?: string; steps: Step[] }
const jobs = (release as { jobs: Record<string, Job> }).jobs
const runs = (job: string) => jobs[job]?.steps.map((s) => s.run ?? '') ?? []
const at = (job: string, text: string) => runs(job).findIndex((r) => r.includes(text))

// Lays out a global install: node_modules/webular/dist/webular.js plus a fake
// native package that echoes its arguments and exits 7.
const install = async (withNative: boolean) => {
  const dir = mkdtempSync(join(tmp, 'install-'))
  const launcher = join(dir, 'node_modules', 'webular', 'dist', 'webular.js')
  const built = Bun.spawnSync([
    'bun',
    'build',
    join(ROOT, 'src/release/node-launcher.ts'),
    '--target=node',
    '--format=esm',
    `--outfile=${launcher}`,
  ])
  expect(built.exitCode).toBe(0)
  const target = targetFor(await runtime.runPromise(hostFacts)) as Target
  expect(target).toBeDefined()
  if (withNative) {
    const native = join(dir, 'node_modules', packageName(target))
    mkdirSync(join(native, 'bin'), { recursive: true })
    writeFileSync(join(native, 'package.json'), '{"name":"x","version":"0.0.0"}')
    const exe = join(native, 'bin', exeName(target))
    if (target.os === 'win32') {
      // Windows runs no shebang script, so the fake is a real compiled .exe.
      const source = join(dir, 'fake-native.ts')
      writeFileSync(
        source,
        "console.log('native ' + process.argv.slice(2).join(' '))\nprocess.exit(7)\n",
      )
      expect(
        Bun.spawnSync(['bun', 'build', '--compile', source, `--outfile=${exe}`]).exitCode,
      ).toBe(0)
    } else writeFileSync(exe, '#!/bin/sh\necho "native $*"\nexit 7\n', { mode: 0o755 })
  }
  return { launcher, name: packageName(target) }
}
// Node without Bun on PATH.
const node = Bun.which('node') ?? 'node'
const runLauncher = (launcher: string) =>
  Bun.spawnSync([node, launcher, 'scrape', 'x'], { env: { PATH: '/usr/bin:/bin' } })

test('the Node launcher runs the native package with no Bun on PATH', async () => {
  const { launcher } = await install(true)
  const result = runLauncher(launcher)
  expect(result.stdout.toString().trim()).toBe('native scrape x')
  expect(result.exitCode).toBe(7)
}, 30_000) // a Windows run compiles the fake .exe first

test('without the native package or Bun, the launcher names the missing package', async () => {
  const { launcher, name } = await install(false)
  const result = runLauncher(launcher)
  expect(result.exitCode).toBe(1)
  expect(result.stderr.toString()).toContain(name)
})

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
