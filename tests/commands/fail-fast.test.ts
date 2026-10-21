// FAIL-FAST contract: a flag error exits within about 2 s of startup work that
// the error itself needs. Importing @mastra/core costs seconds of disk reads,
// so no command entry may load its workflow before its flags validate.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

describe('failing commands exit fast', () => {
  test(
    'no command entry statically imports a workflow module',
    eff(
      Effect.gen(function* () {
        const files = [...new Bun.Glob('src/commands/*.ts').scanSync(ROOT)]
        const texts = yield* Effect.forEach(
          files,
          (f) => io(() => Bun.file(`${ROOT}${f}`).text()),
          {
            concurrency: 8,
          },
        )
        const eager = files.filter((_, i) =>
          /^import [^\n]* from '\.\.\/workflows\//m.test(texts[i] ?? ''),
        )
        expect(eager).toEqual([])
      }),
    ),
  )

  test(
    'search with an unknown --source fails without loading Mastra',
    eff(
      Effect.gen(function* () {
        const start = yield* Effect.clockWith((c) => c.currentTimeMillis)
        const { code, err } = yield* runCli('src/commands/search.ts', ['bun', '--source', 'nope'])
        const ms = (yield* Effect.clockWith((c) => c.currentTimeMillis)) - start
        expect(code).toBe(2)
        expect(err).toContain('--source must be one of')
        // ponytail: wall-clock bound under machine load; the static check above is the exact guard.
        expect(ms).toBeLessThan(2000)
      }),
    ),
    15_000,
  )
})
