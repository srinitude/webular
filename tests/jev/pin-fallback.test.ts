// Pin and fallback rules: WEBULAR_JEV=off means every decision uses its baseline,
// even when a replay folder is set, and a payload builder that throws still
// hands the call to the baseline instead of ending the workflow with a defect.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { type DecisionDef, defineDecision } from '../../src/lib/jev/define.ts'

const jevWith = (env: Record<string, string>) =>
  Jev.layer.pipe(
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, BunServices.layer)),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
  )

test('WEBULAR_JEV=off is unavailable even with a replay folder or a key', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const withReplay = yield* Jev.pipe(
        Effect.provide(jevWith({ WEBULAR_JEV: 'off', WEBULAR_JEV_REPLAY: '/tmp/none' })),
      )
      const withKey = yield* Jev.pipe(
        Effect.provide(jevWith({ WEBULAR_JEV: 'off', TYPESAFE_API_KEY: 'k' })),
      )
      expect([withReplay.available, withKey.available]).toEqual([false, false])
    }),
  ))

test('a throwing payload builder falls back instead of dying', () => {
  const base = decisions.mapKind.def as unknown as DecisionDef<unknown, string>
  const boom = defineDecision<unknown, string>({
    ...base,
    payload: () => {
      throw new Error('payload builder blew up')
    },
    fallback: () => 'baseline',
  })
  const live = Layer.succeed(
    Jev,
    Jev.of({
      available: true,
      ask: () => Effect.succeed<JevResult>({ answers: {}, inputTokens: 0 }),
    }),
  )
  return Effect.runPromise(
    boom(undefined).pipe(
      Effect.provide(live),
      Effect.map((r) => expect(r).toBe('baseline')),
    ),
  )
})
