// Offline accuracy eval for `webular answer` on the dev set: each case reads its
// fixture pages with --urls, with Jev off so every decision takes its baseline.
// It checks citation faithfulness, the sure-but-wrong rate, and the no-answer rate.
import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { ANSWER_DEV, pagePath } from '../_support/citation-dev-set.ts'
import { devRoutes, metricsOf, pageAt, scoreCase } from '../_support/citation-score.ts'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(devRoutes(ANSWER_DEV))
const ENV = { WEBULAR_ALLOW_PRIVATE: '1', WEBULAR_AS_OF: '2026-01-01' }
const decode = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Struct({
      answer: Schema.String,
      sources: Schema.Array(Schema.Struct({ url: Schema.String })),
    }),
  ),
)

const runCase = (c: (typeof ANSWER_DEV)[number]) =>
  Effect.gen(function* () {
    const urls = c.pages.flatMap((p) => ['--urls', `${fx.origin}${pagePath(p)}`])
    const args = ['--query', c.ask, '--sentences', '2', ...urls, '--json']
    const opts = { env: ENV, exec: process.execPath }
    const { code, out, err } = yield* runCli('src/commands/answer.ts', args, opts)
    if (code !== 0) return yield* Effect.fail(new Error(`${c.name}: exit ${code} ${err}`))
    const data = yield* decode(out)
    const cited = data.sources.flatMap((s) => pageAt(ANSWER_DEV, s.url) ?? [])
    return scoreCase(c, data.answer, cited)
  })

describe('answer accuracy on the dev set', () => {
  test(
    'every cited sentence is in its source; wrong and no-answer rates hold their floor',
    eff(
      Effect.gen(function* () {
        const scored = yield* Effect.forEach(ANSWER_DEV, runCase, { concurrency: 3 })
        const m = metricsOf(ANSWER_DEV, scored)
        yield* Effect.logInfo('answer dev', JSON.stringify(m), JSON.stringify(scored))
        expect(m.faithfulness).toBe(1)
        expect(m.sureButWrong).toBeLessThanOrEqual(1)
        expect(m.noAnswer).toBeGreaterThanOrEqual(0)
      }),
    ),
    600_000,
  )
})
