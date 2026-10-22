// Pack-list guard: `bun pm pack --dry-run` on the root package must never list
// a handoff file, an env file, recordings, raw bench results, or .claude. A
// scratch package that does ship them proves the matcher fires.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

const FORBIDDEN =
  /(^|\/)(handoff\.txt|\.env[^/]*|recordings|\.claude)(\/|$)|(^|\/)bench\/results\/raw(\/|$)/

const forbidden = (paths: ReadonlyArray<string>) => paths.filter((p) => FORBIDDEN.test(p))

// `--ignore-scripts` skips prepack, which would run the full build.
const packList = (cwd: string) =>
  runProc(['bun', 'pm', 'pack', '--dry-run', '--ignore-scripts'], { cwd, timeoutMs: 30_000 }).pipe(
    Effect.map((out) =>
      out.stdout.split('\n').flatMap((line) => /^packed\s+\S+\s+(.+)$/.exec(line)?.[1] ?? []),
    ),
  )

test('the matcher passes shipped paths', () => {
  expect(
    forbidden([
      'src/cli/route.ts',
      'bin/webular',
      'bench/results/summary.json',
      'docs/environment.md',
    ]),
  ).toEqual([])
})

test(
  'a package that ships forbidden paths is caught',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('webular-packguard-')
      const bad = [
        'handoff.txt',
        '.env.local',
        'recordings/a.mp4',
        '.claude/s.json',
        'bench/results/raw/r.json',
      ]
      yield* fs.writeFileString(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scratch',
          version: '1.0.0',
          files: ['handoff.txt', '.env.local', 'recordings', '.claude', 'bench'],
        }),
      )
      for (const p of bad) {
        yield* fs.makeDirectory(join(dir, p, '..'), { recursive: true })
        yield* fs.writeFileString(join(dir, p), 'x')
      }
      expect(forbidden(yield* packList(dir)).sort()).toEqual([...bad].sort())
    }),
  ),
  30_000,
)

test(
  'the root package ships none of them',
  eff(
    Effect.gen(function* () {
      const files = yield* packList(ROOT)
      expect(files.length).toBeGreaterThan(0)
      expect(forbidden(files)).toEqual([])
    }),
  ),
  30_000,
)
