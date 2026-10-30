// A doctor probe killed by its timeout reports a timeout, never the bare "exit 143".
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { versionCheck } from '../../src/lib/doctor.ts'
import { eff, tmpDir } from '../_support/run.ts'

test(
  'a slow --version probe reports a timeout, not exit 143',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('doctor-timeout-')
      const bin = `${dir}/slow-tool`
      yield* fs.writeFileString(bin, '#!/bin/sh\nexec sleep 30\n')
      yield* fs.chmod(bin, 0o755)
      const check = yield* versionCheck('deepsec', bin, 300)
      expect(check.ok).toBe(false)
      expect(check.detail).toContain('timed out')
      expect(check.detail).not.toMatch(/exit 143/)
    }),
  ),
)
