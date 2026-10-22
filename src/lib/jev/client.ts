// Jev (TypeSafe System One) client: typed judgments for webular's decision steps.
// Jev decides; code acts. Every caller keeps a deterministic fallback, so a
// missing key, a timeout, or an API error never blocks a workflow.
import { BunServices } from '@effect/platform-bun'
import {
  Config,
  Context,
  Effect,
  FileSystem,
  Layer,
  ManagedRuntime,
  Option,
  Redacted,
} from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import * as ChildProcess from 'effect/process/ChildProcess'
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner'
import { docsStore } from './docs-cache.ts'
import { committedSnapshot } from './docs-guard.ts'
import type { JevError } from './errors.ts'
import { withRecorder } from './learn/recorder.ts'
import { isReleasedModel, JEV_LATEST_RELEASED } from './model.ts'
import type { Instructions, OptionSpec } from './payload/answers.ts'
import { postOnce, type Result, withRetry } from './post.ts'
import { flagDrift, logCalibration, makeAsk, makeLru, replayStore } from './store.ts'

// Every call goes to the highest released Jev model (./model.ts). For tests only,
// WEBULAR_JEV_MODEL may name another released id; an alias or preview name there
// is ignored, so a call never goes to a moving target.
export const JEV_MODEL_DEFAULT = JEV_LATEST_RELEASED
// Every call runs the docs-guard check (./docs-guard.ts) first, inside postOnce.
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const CACHE_CAPACITY = 1_024 // LRU entries; each holds only answers, keyed by a 64-bit hash
export const JEV_CONCURRENCY = 8 // under the per-org request rate

type Text = string | Instructions
export type JevQuestion =
  | { readonly type: 'noul'; readonly instructions: Text }
  | {
      readonly type: 'choice'
      readonly instructions: Text
      readonly criteria: Record<string, string | null | OptionSpec>
    }
  | {
      readonly type: 'score'
      readonly instructions: Text
      readonly criteria: ReadonlyArray<string | OptionSpec>
    }

export interface JevRequest {
  readonly state: Record<string, unknown>
  readonly questions: Record<string, JevQuestion>
}

export type JevResult = typeof Result.Type
export type JevAnswer = JevResult['answers'][string]

const optional = <A, E, R>(eff: Effect.Effect<Option.Option<A>, E, R>) =>
  eff.pipe(Effect.orElseSucceed(() => Option.none<A>()))
const setting = (name: string) => optional(Config.option(Config.String(name)))

// Key order: TYPESAFE_API_KEY, then the macOS Keychain item typesafe-ai-api-key.
// WEBULAR_JEV=off turns Jev off, so every decision uses its baseline.
const resolveKey = Effect.gen(function* () {
  if (Option.contains(yield* setting('WEBULAR_JEV'), 'off'))
    return Option.none<Redacted.Redacted<string>>()
  const env = yield* optional(Config.option(Config.Redacted('TYPESAFE_API_KEY')))
  if (Option.isSome(env)) return env
  const spawner = yield* ChildProcessSpawner
  const out = yield* optional(
    spawner
      .string(ChildProcess.make`security find-generic-password -s typesafe-ai-api-key -w`)
      .pipe(Effect.map((s) => Option.liftPredicate(s.trim(), (k) => k.length > 0))),
  )
  return Option.map(out, (k) => Redacted.make(k))
})

const make = Effect.gen(function* () {
  const key = yield* resolveKey
  const http = yield* HttpClient.HttpClient
  const fs = yield* FileSystem.FileSystem
  const model = (yield* setting('WEBULAR_JEV_MODEL')).pipe(
    Option.filter(isReleasedModel),
    Option.getOrElse(() => JEV_LATEST_RELEASED),
  )
  const record = Option.contains(yield* setting('WEBULAR_JEV_RECORD'), '1')
  const replay = Option.map(yield* setting('WEBULAR_JEV_REPLAY'), (d) => replayStore(fs, d, record))
  const ask = makeAsk({
    model,
    replay,
    live: withRetry(
      postOnce(ENDPOINT, http, key, { snapshot: committedSnapshot, store: yield* docsStore }),
    ),
    lru: yield* Effect.sync(() => makeLru(CACHE_CAPACITY)),
    log: logCalibration(fs, yield* setting('WEBULAR_JEV_LOG')),
    drift: flagDrift(fs, yield* setting('WEBULAR_JEV_DRIFT_FILE')),
  })
  // Learning loop: every call gets a row, and kept lessons reshape payloads.
  return yield* withRecorder(
    Jev.of({ available: Option.isSome(key) || Option.isSome(replay), ask }),
  )
})

export class Jev extends Context.Service<
  Jev,
  {
    readonly available: boolean
    readonly ask: (decision: string, req: JevRequest) => Effect.Effect<JevResult, JevError>
  }
>()('webular/lib/jev/Jev') {
  static readonly layer = Layer.effect(Jev, make)

  static readonly live = Jev.layer.pipe(
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, BunServices.layer)),
  )
}

// One runtime for the Promise-based Mastra steps; it builds the Jev layer on first use.
export const jevRuntime = ManagedRuntime.make(Jev.live)
