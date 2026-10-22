// runCli spawns the built bundle only while the build is at least as new as
// every source file; a stale or missing build falls back to the source entry.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { builtEntry } from '../_support/cli.ts'
import { eff, tmpDir } from '../_support/run.ts'

const SRC = 'src/commands/scrape.ts'
const DIST = 'dist/commands/scrape.js'

// A root with the source entry at time `srcAt` and, when given, a build at `distAt`.
const layout = (srcAt: number, distAt?: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const root = `${yield* tmpDir('cli-entry-')}/`
    yield* fs.makeDirectory(`${root}src/commands`, { recursive: true })
    yield* fs.writeFileString(`${root}${SRC}`, '')
    yield* fs.utimes(`${root}${SRC}`, srcAt, srcAt)
    if (distAt === undefined) return root
    yield* fs.makeDirectory(`${root}dist/commands`, { recursive: true })
    yield* fs.writeFileString(`${root}${DIST}`, '')
    yield* fs.utimes(`${root}${DIST}`, distAt, distAt)
    return root
  })

const picks = (srcAt: number, distAt: number | undefined, want: string) =>
  eff(
    Effect.flatMap(layout(srcAt, distAt), (root) =>
      Effect.map(builtEntry(SRC, root), (got) => expect(got).toBe(want)),
    ),
  )

describe('builtEntry', () => {
  test('a build newer than every source file runs the bundle', picks(1_000, 2_000, DIST))
  test('a source file newer than the build runs the source', picks(2_000, 1_000, SRC))
  test('no build runs the source', picks(1_000, undefined, SRC))
  test(
    'an entry outside src/commands stays as given',
    eff(Effect.map(builtEntry('bin/webular.ts'), (got) => expect(got).toBe('bin/webular.ts'))),
  )
})
