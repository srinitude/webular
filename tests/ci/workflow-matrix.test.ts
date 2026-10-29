// Floor guard for CI/CD speed work: no speedup may shrink what runs. Each
// workflow keeps every job, every OS, and every lint, typecheck, build, and
// test step, and a sharded OS covers shards 1..n of n, so every test file
// still runs exactly once on it (bun test --shard splits the file list).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { loadGraph } from '../_support/graph.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

type Step = { readonly run?: string }
type Entry = { readonly os?: string; readonly shard?: string }
type Matrix = { readonly include?: ReadonlyArray<Entry>; readonly os?: ReadonlyArray<string> }
type Job = {
  readonly steps?: ReadonlyArray<Step>
  readonly strategy?: { readonly matrix?: Matrix }
}
type Workflow = { readonly jobs: Record<string, Job> }

const SIX_OS = [
  'macos-15-intel',
  'macos-latest',
  'ubuntu-24.04-arm',
  'ubuntu-latest',
  'windows-11-arm',
  'windows-latest',
]
const THREE_OS = ['macos-latest', 'ubuntu-latest', 'windows-latest']

const workflow = (name: string) =>
  io(() => Bun.file(`${ROOT}.github/workflows/${name}`).text()).pipe(
    Effect.map((yml) => Bun.YAML.parse(yml) as Workflow),
  )

const entries = (job: Job | undefined): ReadonlyArray<Entry> =>
  job?.strategy?.matrix?.include ?? (job?.strategy?.matrix?.os ?? []).map((os) => ({ os }))

const oses = (job: Job | undefined) => [...new Set(entries(job).map((e) => e.os))].sort()

const runs = (job: Job | undefined) => (job?.steps ?? []).map((s) => s.run ?? '').join('\n')

// Per OS: one unsharded entry, or shards exactly 1/n..n/n.
const shardsComplete = (job: Job | undefined) =>
  Object.values(Object.groupBy(entries(job), (e) => e.os ?? '')).every((group = []) => {
    const shards = group.flatMap((e) => (e.shard === undefined ? [] : [e.shard]))
    if (shards.length === 0) return group.length === 1
    const want = Array.from({ length: group.length }, (_, i) => `${i + 1}/${group.length}`)
    return [...shards].sort().join() === want.join()
  })

test(
  'ci.yml keeps every job, OS, spine step, and a complete test shard set',
  eff(
    Effect.gen(function* () {
      const ci = yield* workflow('ci.yml')
      expect(Object.keys(ci.jobs).sort()).toEqual([
        'alpine',
        'ci',
        'executable',
        'nix',
        'push-covered-by-pr',
        'site',
      ])
      expect(runs(ci.jobs['site'])).toMatch(/mise run site:build[\s\S]*mise run site:test/)
      expect(oses(ci.jobs['ci'])).toEqual(SIX_OS)
      expect(oses(ci.jobs['executable'])).toEqual(THREE_OS)
      expect(shardsComplete(ci.jobs['ci'])).toBe(true)
      const ciRuns = runs(ci.jobs['ci'])
      for (const cmd of ['mise run ci', 'mise run e2e', 'mise run build', 'mise run test']) {
        expect([cmd, ciRuns.includes(cmd)]).toEqual([cmd, true])
      }
      expect(runs(ci.jobs['alpine'])).toMatch(/mise run ci[\s\S]*mise run e2e/)
      expect(runs(ci.jobs['executable'])).toContain('mise run build')
      expect(runs(ci.jobs['executable'])).toContain('./dist/bin/webular --version')
      expect(runs(ci.jobs['nix'])).toMatch(
        /nix build \.#webular[\s\S]*\.\/result\/bin\/webular --version/,
      )
    }),
  ),
)

test(
  'the ci spine still reaches lint, typecheck, build, test, and the bug checks',
  eff(
    Effect.gen(function* () {
      const tasks = yield* Effect.sync(loadGraph)
      const reached = new Set<string>()
      const queue = ['ci']
      for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
        if (reached.has(name)) continue
        reached.add(name)
        queue.push(...(tasks[name]?.depends ?? []))
      }
      for (const step of [
        'setup',
        'lint',
        'bugs:static',
        'typecheck',
        'build',
        'test',
        'bugs:check',
      ]) {
        expect([step, reached.has(step)]).toEqual([step, true])
      }
    }),
  ),
)

test(
  'plugin.yml and release.yml keep every job, OS, and check step',
  eff(
    Effect.gen(function* () {
      const plugin = yield* workflow('plugin.yml')
      expect(oses(plugin.jobs['plugin'])).toEqual(THREE_OS)
      expect(runs(plugin.jobs['plugin'])).toContain('mise run plugin:ci')
      const release = yield* workflow('release.yml')
      for (const job of ['test', 'test-musl', 'assets', 'smoke', 'publish', 'homebrew', 'scoop']) {
        expect([job, job in release.jobs]).toEqual([job, true])
      }
      expect(oses(release.jobs['test'])).toEqual(SIX_OS)
      expect(runs(release.jobs['test'])).toContain('mise run test')
      expect(runs(release.jobs['test-musl'])).toContain('mise run test')
      expect(entries(release.jobs['smoke']).length).toBeGreaterThanOrEqual(8)
      const all = Object.values(release.jobs).map(runs).join('\n')
      expect(all).toContain('mise run compile:all')
      expect(all).toContain('mise run build')
    }),
  ),
)
