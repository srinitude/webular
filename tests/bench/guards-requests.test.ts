// The bench runner's Row.requests channel: webular's step runtime logs every
// request to WEBULAR_REQUEST_LOG, robots.txt reads included, and a disallowed
// fixture page is refused before any GET of it.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Layer } from 'effect'
import { startBenchFixture } from '../../bench/fixtures/server.ts'
import { robotsOutcome } from '../../scripts/bench/robots-grade.ts'
import type { Row } from '../../scripts/bench/schema.ts'
import { readRequests } from '../../scripts/bench/worker-io.ts'
import { isRobotsBlock, RobotsGate, robotsGate } from '../../src/lib/robots-gate.ts'
import { requestLog } from '../../src/workflows/runtime.ts'
import { eff, tmpDir } from '../_support/run.ts'

test(
  'a fixture run records the robots.txt GET and no disallowed GET',
  eff(
    Effect.gen(function* () {
      const fx = yield* startBenchFixture
      const file = `${yield* tmpDir('requests-')}/requests.jsonl`
      const env = ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBULAR_REQUEST_LOG: file }))
      const err = yield* Effect.flip(robotsGate(`${fx.origin}/pages/blocked/a.html`)).pipe(
        Effect.provide(RobotsGate.layer.pipe(Layer.provideMerge(requestLog), Layer.provide(env))),
      )
      const requests = yield* readRequests(file)
      expect(isRobotsBlock(err)).toBe(true)
      expect(requests).toEqual([{ method: 'GET', url: `${fx.origin}/robots.txt` }])
      expect(robotsOutcome({ requests } as Row)).toBe('compliant')
    }),
  ),
  30_000,
)
