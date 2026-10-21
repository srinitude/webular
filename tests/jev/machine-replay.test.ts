// Machine-only moves and record-and-replay for the Jev client.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, Exit, FileSystem, Layer } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { type AnyMachineSnapshot, createActor } from 'xstate'
import { JEV_MODEL_DEFAULT, Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { allowedEvents, machineDecision } from '../../src/lib/jev/machine.ts'
import { cacheKey, purpose, requestBytes } from '../../src/lib/jev/payload/index.ts'
import { commandLifecycleMachine } from '../../src/machines/command-lifecycle.ts'

const fakeJev = (choice: string, confidence: number) =>
  Layer.succeed(
    Jev,
    Jev.of({
      available: true,
      ask: () =>
        Effect.succeed<JevResult>({
          // Both option orders agree, so this tests the allowed-move rule alone.
          answers: {
            next: { type: 'choice', choice, confidence },
            next_swapped: { type: 'choice', choice, confidence },
          },
          inputTokens: 0,
        }),
    }),
  )
const TYPES = [
  'INPUT_INVALID',
  'INPUT_VALID',
  'WORKFLOW_FAILED',
  'WORKFLOW_SUCCEEDED',
  'NO_ERRORS',
  'SOME_ERRORS',
  'EMPTY_WITH_ERRORS',
  'BOGUS',
]
const snapshotsAlongHappyPath = (): AnyMachineSnapshot[] => {
  const actor = createActor(commandLifecycleMachine).start()
  const out: AnyMachineSnapshot[] = [actor.getSnapshot()]
  actor.send({ type: 'INPUT_VALID' })
  out.push(actor.getSnapshot())
  actor.send({ type: 'WORKFLOW_SUCCEEDED' })
  out.push(actor.getSnapshot())
  actor.stop()
  return out
}

test('allowedEvents lists exactly the moves the snapshot can take', () => {
  const [start, , rendering] = snapshotsAlongHappyPath()
  expect(allowedEvents(start as AnyMachineSnapshot).sort()).toEqual([
    'INPUT_INVALID',
    'INPUT_VALID',
  ])
  expect(allowedEvents(rendering as AnyMachineSnapshot).sort()).toEqual([
    'EMPTY_WITH_ERRORS',
    'NO_ERRORS',
    'PARTIAL',
    'SOME_ERRORS',
  ])
})

// One case: Jev picks `pick` at `confidence`; the code observed `observed`.
const decideCase = (s: AnyMachineSnapshot, pick: string, observed: string, confidence: number) =>
  machineDecision({
    machine: commandLifecycleMachine,
    snapshot: s,
    observed: { type: observed },
    goal: 'finish the command',
  }).pipe(
    Effect.provide(fakeJev(pick, confidence)),
    Effect.map((got) => {
      const allowed = allowedEvents(s)
      const fallback = allowed.includes(observed) ? observed : undefined
      const want = confidence >= 0.95 && allowed.includes(pick) ? pick : fallback
      return { got, want, allowedOk: got === undefined || allowed.includes(got) }
    }),
  )
const allCases = () =>
  snapshotsAlongHappyPath().flatMap((s) =>
    TYPES.flatMap((pick) =>
      TYPES.flatMap((obs) => [0.5, 0.94, 0.95, 0.99].map((c) => decideCase(s, pick, obs, c))),
    ),
  )

test('every pick is an allowed move; under the bar the observed move wins', () => {
  const results = Effect.runSync(Effect.all(allCases(), { concurrency: 1 }))
  expect(results.length).toBe(3 * 8 * 8 * 4)
  expect(results.every((r) => r.allowedOk)).toBe(true)
  expect(results.filter((r) => r.got !== r.want)).toEqual([])
})

// Jev's live layer, reading config from `env` instead of the process.
const jevWith = (env: Record<string, string>) =>
  Jev.layer.pipe(
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, BunServices.layer)),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
  )
const P = purpose('m', 'o', 'w', 'b')
const Q = { q: { type: 'noul', instructions: 'Is `a` set?' } } as const
const answer = { answers: { q: { type: 'noul', noul: 0.99 } }, inputTokens: 5, model: 'jev-1.13.0' }

const replayRun = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'jev-replay-' })
  const req = { state: { purpose: P, a: 1 }, questions: Q }
  const key = cacheKey(requestBytes(JEV_MODEL_DEFAULT, req.state, req.questions))
  yield* fs.writeFileString(`${dir}/${key.toString(16)}.json`, JSON.stringify(answer))
  const env = { WEBULAR_JEV_REPLAY: dir, TYPESAFE_API_KEY: 'unused-in-replay' }
  return yield* Effect.gen(function* () {
    const jev = yield* Jev
    const first = yield* jev.ask('t', req)
    const second = yield* jev.ask('t', req)
    const miss = yield* Effect.exit(jev.ask('t', { ...req, state: { purpose: P, a: 2 } }))
    return { first: first.source, second: second.source, miss }
  }).pipe(Effect.provide(jevWith(env)))
}).pipe(Effect.scoped, Effect.provide(BunServices.layer))

test('a replay hit needs no key; a replay miss is a defect no fallback hides', () =>
  Effect.runPromise(
    replayRun.pipe(
      Effect.map((r) =>
        expect({
          first: r.first,
          second: r.second,
          missDies: Exit.isFailure(r.miss) && Exit.hasDies(r.miss),
        }).toEqual({ first: 'replay', second: 'cache', missDies: true }),
      ),
    ),
  ))
