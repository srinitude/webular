// Jev requests go through the shared request log: with WEBULAR_REQUEST_LOG set,
// a Jev call appends its request to that file like every other fetch does.
// The env and fetch come in as layers, not process.env or globalThis writes:
// Effect caches its default ConfigProvider (a process.env copy) and the default
// Fetch on first use, so a mutation after an earlier test's first read is lost.
import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { ConfigProvider, Effect, Layer, ManagedRuntime } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { Jev } from '../../src/lib/jev/client.ts'

test('a Jev call writes a line to the WEBULAR_REQUEST_LOG file', async () => {
  const dir = `${import.meta.dir}/../../.tmp-run/jev-request-log`
  const log = `${dir}/requests.jsonl`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const env = ConfigProvider.fromEnvRecord({
    WEBULAR_REQUEST_LOG: log,
    WEBULAR_CACHE_DIR: `${dir}/cache`,
    TYPESAFE_API_KEY: 'test-key',
  })
  const fetch500 = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch
  const rt = ManagedRuntime.make(
    Jev.live.pipe(
      Layer.provide(
        Layer.mergeAll(ConfigProvider.layer(env), Layer.succeed(FetchHttpClient.Fetch, fetch500)),
      ),
    ),
  )
  try {
    await rt.runPromise(
      Jev.use((j) =>
        j.ask('request-log', {
          state: { text: 'x' },
          questions: { q: { type: 'noul', instructions: 'Is x a letter?' } },
        }),
      ).pipe(Effect.exit),
    )
    const lines = existsSync(log)
      ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
      : []
    expect(lines.some((l) => l.includes('api.typesafe.ai'))).toBe(true)
  } finally {
    await rt.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})
