// Jev route order, base-URL override, each route's request shape, and the doctor
// row. Fake HTTP and fake keys only: no live key, no network.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Option, Redacted } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'
import { systemOne } from '../../src/lib/jev/client.ts'
import { checkJevRoute } from '../../src/lib/jev/doctor-route.ts'
import { jevRequest } from '../../src/lib/jev/post.ts'
import { type JevRoute, resolveRoute } from '../../src/lib/jev/route.ts'
import { eff } from '../_support/run.ts'

const DIRECT = 'direct-fake-key'
const GATEWAY = 'gateway-fake-key'
const noKey = Effect.succeed(Option.none<Redacted.Redacted<string>>())
const envKey = Effect.succeed(Option.some(Redacted.make(DIRECT)))

const route = (env: Record<string, string>, direct = noKey) =>
  resolveRoute(direct).pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
    Effect.map(Option.getOrUndefined),
  )

test(
  'the direct key wins over a gateway key',
  eff(
    Effect.gen(function* () {
      const r = yield* route({ PYDANTIC_AI_GATEWAY_API_KEY: GATEWAY }, envKey)
      expect(r?.name).toBe('typesafe')
      expect(r?.base).toBe('https://api.typesafe.ai')
      expect(Redacted.value(r?.key ?? Redacted.make(''))).toBe(DIRECT)
    }),
  ),
)

test(
  'WEBULAR_JEV=off means no route, even with every key set',
  eff(
    Effect.gen(function* () {
      const env = { WEBULAR_JEV: 'off', PYDANTIC_AI_GATEWAY_API_KEY: GATEWAY }
      expect(yield* route(env, envKey)).toBeUndefined()
    }),
  ),
)

test(
  'TYPESAFE_BASE_URL moves the direct route, trailing slash dropped',
  eff(
    Effect.gen(function* () {
      const r = yield* route({ TYPESAFE_BASE_URL: 'http://127.0.0.1:4000/typesafe/' }, envKey)
      expect(r?.name).toBe('typesafe')
      expect(r && systemOne(r)).toBe('http://127.0.0.1:4000/typesafe/v1/systemone')
    }),
  ),
)

test(
  'with no direct key, the Pydantic gateway key picks the gateway; no key, no route',
  eff(
    Effect.gen(function* () {
      const r = yield* route({ PYDANTIC_AI_GATEWAY_API_KEY: GATEWAY })
      expect(r?.name).toBe('pydantic')
      expect(r && systemOne(r)).toBe('https://gateway-us.pydantic.dev/proxy/typesafe/v1/systemone')
      // Vercel's key is not a route: its docs name only an alias model.
      expect(yield* route({ AI_GATEWAY_API_KEY: GATEWAY })).toBeUndefined()
    }),
  ),
)

test('each route posts the same body with its own key as a Bearer token', () => {
  const body = '{"model":"jev-1.14.0","state":{},"questions":{}}'
  const routes: JevRoute[] = [
    { name: 'typesafe', base: 'https://api.typesafe.ai', key: Redacted.make(DIRECT) },
    {
      name: 'pydantic',
      base: 'https://gateway-us.pydantic.dev/proxy/typesafe',
      key: Redacted.make(GATEWAY),
    },
  ]
  for (const r of routes) {
    const req = jevRequest(systemOne(r), r.key, body)
    expect(req.method).toBe('POST')
    expect(req.url).toBe(`${r.base}/v1/systemone`)
    expect(req.headers['authorization']).toBe(`Bearer ${Redacted.value(r.key)}`)
    expect(req.body._tag).toBe('Uint8Array')
  }
})

// The doctor row: GET <base>/v1/models with the key; the key never shows.
const doctor = (env: Record<string, string>, status: number) => {
  const seen: Array<{ url: string; auth: string | undefined }> = []
  const client = HttpClient.make((req) =>
    Effect.sync(() => {
      seen.push({ url: req.url, auth: req.headers['authorization'] })
      return HttpClientResponse.fromWeb(req, new Response('{"models":[]}', { status }))
    }),
  )
  return checkJevRoute.pipe(
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
    Effect.map((row) => ({ row, seen })),
  )
}

test(
  'doctor reports the active route and checks it, never printing the key',
  eff(
    Effect.gen(function* () {
      const env = { TYPESAFE_API_KEY: DIRECT, TYPESAFE_BASE_URL: 'http://127.0.0.1:9/ts' }
      const ok = yield* doctor(env, 200)
      expect(ok.seen).toEqual([
        { url: 'http://127.0.0.1:9/ts/v1/models', auth: `Bearer ${DIRECT}` },
      ])
      expect(ok.row).toEqual({
        name: 'jev',
        ok: true,
        detail: 'typesafe at http://127.0.0.1:9/ts, model jev-1.14.0: GET /v1/models HTTP 200',
      })
      const bad = yield* doctor(env, 401)
      expect(bad.row.ok).toBe(false)
      expect(JSON.stringify(bad.row)).not.toContain(DIRECT)
      const off = yield* doctor({ WEBULAR_JEV: 'off', TYPESAFE_API_KEY: DIRECT }, 200)
      expect(off.row.detail).toBe('off (WEBULAR_JEV=off)')
      expect(off.seen).toEqual([])
    }),
  ),
)
