// Every workflow checkout drops its token from .git/config, so a later step
// (or a compromised action) cannot reuse it; no job here runs `git push`.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

test(
  'each actions/checkout step sets persist-credentials: false',
  eff(
    Effect.gen(function* () {
      for (const path of new Bun.Glob('.github/workflows/*.yml').scanSync(ROOT)) {
        const yml = yield* io(() => Bun.file(`${ROOT}${path}`).text())
        const steps = yml.split(/^\s*- /m).filter((s) => s.startsWith('uses: actions/checkout'))
        for (const step of steps)
          expect([path, step]).toEqual([
            path,
            expect.stringContaining('persist-credentials: false'),
          ])
      }
    }),
  ),
)
