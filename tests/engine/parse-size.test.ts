// parseDocument checks the file size before it reads: an oversized file fails
// fast with a clear message instead of loading the whole file into memory.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { parseDocument } from '../../src/lib/parse.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

describe('parse size budget', () => {
  test(
    'a sparse 1 GiB text file fails before it is read',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const file = `${yield* tmpDir('parse-size-')}/huge.txt`
        yield* fs.writeFileString(file, 'x')
        yield* fs.truncate(file, 1024 ** 3)
        expect(yield* failMsg(parseDocument(file))).toContain('too large')
      }),
    ),
  )

  test(
    'a small file still parses',
    eff(
      Effect.gen(function* () {
        const file = `${yield* tmpDir('parse-size-')}/small.txt`
        yield* (yield* FileSystem.FileSystem).writeFileString(file, 'hello')
        expect((yield* parseDocument(file)).markdown).toBe('hello')
      }),
    ),
  )
})
