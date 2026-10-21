// CI/CD contract: local and remote CI share exactly one mise entrypoint,
// and mise can actually resolve the task graph (real behavior, no mocks).
import { describe, expect, test } from 'bun:test'

import { Effect } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

describe('CI/CD wiring — one default dependency path, local and remote', () => {
  test(
    'remote CI runs the single `mise run ci` default path',
    eff(
      Effect.gen(function* () {
        const yml = yield* io(() => Bun.file(`${ROOT}.github/workflows/ci.yml`).text())
        expect(yml).toContain('mise run ci')
        expect(yml).toContain('jdx/mise-action')
      }),
    ),
  )

  test(
    'mise resolves the real task graph and lists capability commands',
    eff(
      Effect.gen(function* () {
        const proc = Bun.spawn(['mise', 'tasks', 'ls'], { cwd: ROOT })
        const out = yield* io(() => new Response(proc.stdout).text())
        yield* io(() => proc.exited)
        expect(out).toContain('run:scrape')
        expect(out).toContain('ci')
      }),
    ),
  )
})
