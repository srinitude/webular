import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { highestReleased, isHigher } from '../../src/lib/jev/model.ts'
import { eff } from '../_support/run.ts'

test(
  'highest released id comes from the models table, not aliases',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(`${import.meta.dir}/../fixtures/jev-docs/llms-full.txt`)
      expect(highestReleased(text)).toBe('jev-1.14.0')
      expect(highestReleased('| Model ID | `jev-1.9.0` | `jev-1.10.0` |')).toBe('jev-1.10.0')
      expect(highestReleased('no table jev-9.9.9')).toBeUndefined()
      expect(isHigher('jev-1.14.0', 'jev-1.13.0')).toBe(true)
      expect(isHigher('jev-1.13.0', 'jev-1.13.0')).toBe(false)
    }),
  ),
)
