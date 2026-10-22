// Security contract for outPath under WEBULAR_SANDBOX=1: a symlink (even a
// dangling one) whose target lies outside the sandbox is refused, and the ".."
// escape test works on path segments, not on a name prefix.
import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { outPath } from '../../src/core/safepath.ts'
import { eff, tmpDir } from '../_support/run.ts'

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
})

const sandboxed = (base: string) => {
  process.env['WEBULAR_SANDBOX'] = '1'
  process.env['WEBULAR_OUTPUT_DIR'] = base
}

describe('outPath sandbox confinement', () => {
  test(
    'refuses a dangling symlink whose target is outside the sandbox',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const base = yield* tmpDir('webular-sp-base-')
        const outside = yield* tmpDir('webular-sp-out-')
        yield* fs.symlink(join(outside, 'missing', 'evil.md'), join(base, 'dangling'))
        sandboxed(base)
        const err = yield* Effect.flip(outPath('dangling'))
        expect(err.message).toContain('sandbox')
      }),
    ),
  )

  test(
    'refuses a dangling symlink chain that ends outside the sandbox',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const base = yield* tmpDir('webular-sp-base-')
        const outside = yield* tmpDir('webular-sp-out-')
        yield* fs.symlink(join(outside, 'gone.md'), join(base, 'hop2'))
        yield* fs.symlink(join(base, 'hop2'), join(base, 'hop1'))
        sandboxed(base)
        expect((yield* Effect.flip(outPath('hop1'))).message).toContain('sandbox')
      }),
    ),
  )

  test(
    'allows a dangling symlink whose target stays inside the sandbox',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const base = yield* tmpDir('webular-sp-base-')
        yield* fs.symlink(join(base, 'inner.md'), join(base, 'ok'))
        sandboxed(base)
        expect(yield* outPath('ok')).toBe(join(yield* fs.realPath(base), 'ok'))
      }),
    ),
  )

  test(
    'allows a name that merely starts with two dots',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const base = yield* tmpDir('webular-sp-base-')
        yield* fs.makeDirectory(join(base, '..cache'))
        sandboxed(base)
        expect(yield* outPath('..cache/out.md')).toBe(
          join(yield* fs.realPath(base), '..cache', 'out.md'),
        )
        expect(yield* outPath('..foo')).toBe(join(yield* fs.realPath(base), '..foo'))
      }),
    ),
  )

  test(
    'refuses a path that climbs out and back in through "a/../.."',
    eff(
      Effect.gen(function* () {
        const base = yield* tmpDir('webular-sp-base-')
        sandboxed(base)
        expect((yield* Effect.flip(outPath('a/../../x.md'))).message).toContain('sandbox')
        expect((yield* Effect.flip(outPath('..'))).message).toContain('sandbox')
      }),
    ),
  )

  test(
    'without WEBULAR_SANDBOX any path passes through',
    eff(
      Effect.gen(function* () {
        delete process.env['WEBULAR_SANDBOX']
        expect(yield* outPath('/tmp/anywhere.md')).toBe('/tmp/anywhere.md')
        expect(yield* outPath('../x.md')).toContain('x.md')
      }),
    ),
  )
})
