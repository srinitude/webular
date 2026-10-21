// The release workflow's assets job against the packaging it drives: a step
// that runs a mise task depending on compile:all must skip that rebuild (a
// second compile changes the bytes SHA256SUMS and the attestations cover), and
// the completions tarball must exist before SHA256SUMS so every webular-* glob
// (checksum, attest, upload, publish download) carries it.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import release from '../../.github/workflows/release.yml'
import { assetName, TARGETS } from '../../src/core/platform.ts'
import { runProc } from '../../src/core/proc.ts'
import { parseSums } from '../../src/release/distribution.ts'
import { loadGraph } from '../_support/graph.ts'
import { eff, tmpDir } from '../_support/run.ts'

type Step = { name?: string; run?: string; env?: Record<string, string> }
const jobs = (release as { jobs: Record<string, { steps: Step[] }> }).jobs
const steps = (job: string) => jobs[job]?.steps ?? []
const graph = loadGraph()
const indexOf = (text: string) => steps('assets').findIndex((s) => s.run?.includes(text))

// {job, step, task} for every `mise run package:*` whose task depends on compile:all.
const rebuilders = ['assets', 'publish'].flatMap((job) =>
  steps(job).flatMap((step) =>
    [...(step.run ?? '').matchAll(/mise run (package:[\w-]+)/g)]
      .map((m) => m[1] as string)
      .filter((task) => graph[task]?.depends?.includes('compile:all'))
      .map((task) => ({ job, step, task })),
  ),
)

test('every package step that depends on compile:all skips the rebuild', () => {
  expect(rebuilders.length).toBeGreaterThanOrEqual(5)
  for (const { job, step, task } of rebuilders)
    expect(step.env?.['MISE_TASK_SKIP_DEPENDS'], `${job}: ${task}`).toBe('1')
})

test('the completions tarball is staged before SHA256SUMS and shipped by every webular-* glob', () => {
  const tar = indexOf('dist/bin/webular-completions.tar.gz')
  expect(tar).toBeGreaterThan(-1)
  expect(tar).toBeLessThan(indexOf('sha256sum webular-*'))
  const all = JSON.stringify(steps('assets'))
  expect(all.match(/dist\/bin\/webular-\*/g)?.length).toBeGreaterThanOrEqual(2) // attest and upload
  expect(JSON.stringify(steps('publish'))).toContain("--pattern 'webular-*'")
})

test(
  'the workflow checksum step lists all 8 executables and the completions tarball',
  eff(
    Effect.gen(function* () {
      if (!Bun.which('sha256sum')) return // macOS ships shasum only; CI runs Linux
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('webular-sums-')
      const bin = join(dir, 'dist', 'bin')
      yield* fs.makeDirectory(bin, { recursive: true })
      const names = [...TARGETS.map(assetName), 'webular-completions.tar.gz']
      yield* Effect.forEach(names, (name) => fs.writeFileString(join(bin, name), name), {
        concurrency: 4,
        discard: true,
      })
      yield* fs.writeFileString(join(bin, 'webular'), 'host build, not a release file')
      const run = steps('assets').find((s) => s.run?.includes('sha256sum webular-*'))?.run ?? ''
      expect((yield* runProc(['sh', '-c', run], { cwd: dir, timeoutMs: 20_000 })).code).toBe(0)
      const sums = yield* fs.readFileString(join(bin, 'SHA256SUMS'))
      // The parser the release uses: Windows sha256sum marks binary mode with "*".
      const listed = [...parseSums(sums).keys()]
      expect(listed.sort()).toEqual(names.sort())
    }),
  ),
)

test(
  'the source maps bun writes beside the executables are removed before any webular-* glob',
  eff(
    Effect.gen(function* () {
      const cleanup = indexOf('.map')
      expect(cleanup).toBeGreaterThan(-1)
      expect(cleanup).toBeLessThan(indexOf('sha256sum webular-*'))
      const fs = yield* FileSystem.FileSystem
      const bin = join(yield* tmpDir('webular-maps-'), 'dist', 'bin')
      yield* fs.makeDirectory(bin, { recursive: true })
      yield* Effect.forEach(
        ['webular-linux-x64', 'webular-linux-x64.map'],
        (n) => fs.writeFileString(join(bin, n), n),
        { concurrency: 2, discard: true },
      )
      const run = steps('assets')[cleanup]?.run ?? ''
      expect(
        (yield* runProc(['sh', '-c', run], { cwd: join(bin, '..', '..'), timeoutMs: 20_000 })).code,
      ).toBe(0)
      expect(yield* fs.readDirectory(bin)).toEqual(['webular-linux-x64'])
    }),
  ),
)
