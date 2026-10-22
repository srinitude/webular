// Jev requests go through the shared request log: with WEBULAR_REQUEST_LOG set,
// a Jev call appends its request to that file like every other fetch does.
// The env and fetch come in as layers, not process.env or globalThis writes:
// Effect caches its default ConfigProvider (a process.env copy) and the default
// Fetch on first use, so a mutation after an earlier test's first read is lost.
// The log and cache live in an OS temp folder, never the checkout: a folder made
// there shows up as an untracked folder to the AGENTS.md coverage test.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, FileSystem, Layer } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { Jev } from '../../src/lib/jev/client.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fetch500 = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch

// Jev on the given env, with every request answered 500.
const jevOn = (env: ConfigProvider.ConfigProvider) =>
  Jev.live.pipe(
    Layer.provide(
      Layer.mergeAll(ConfigProvider.layer(env), Layer.succeed(FetchHttpClient.Fetch, fetch500)),
    ),
  )

test(
  'a Jev call writes a line to the WEBULAR_REQUEST_LOG file',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('webular-jev-request-log-')
      const log = `${dir}/requests.jsonl`
      const env = ConfigProvider.fromEnvRecord({
        WEBULAR_REQUEST_LOG: log,
        WEBULAR_CACHE_DIR: `${dir}/cache`,
        TYPESAFE_API_KEY: 'test-key',
      })
      yield* Jev.use((j) =>
        j.ask('request-log', {
          state: { text: 'x' },
          questions: { q: { type: 'noul', instructions: 'Is x a letter?' } },
        }),
      ).pipe(Effect.exit, Effect.provide(jevOn(env)))
      const text = yield* Effect.orElseSucceed(fs.readFileString(log), () => '')
      const lines = text.trim().split('\n').filter(Boolean)
      expect(lines.some((l) => l.includes('api.typesafe.ai'))).toBe(true)
    }),
  ),
)
