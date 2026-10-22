// `webular doctor` row for Jev: which route is active (./route.ts) and whether
// its key works, through one GET <base>/v1/models. Never prints a key; a failed
// request reports only its error tag. Jev is optional, so no key passes.
import { Config, Effect, Option, Redacted } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import { resolveKey } from './client.ts'
import { JEV_LATEST_RELEASED } from './model.ts'
import { modelsUrl, resolveRoute } from './route.ts'

const TIMEOUT_MS = 5_000

export const checkJevRoute = Effect.gen(function* () {
  const route = yield* resolveRoute(resolveKey)
  if (Option.isNone(route)) {
    const off = (yield* Config.String('WEBULAR_JEV').pipe(Config.withDefault(''))) === 'off'
    const detail = off ? 'off (WEBULAR_JEV=off)' : 'no key: each decision uses its baseline'
    return { name: 'jev', ok: true, detail }
  }
  const r = route.value
  const where = `${r.name} at ${r.base}, model ${JEV_LATEST_RELEASED}`
  const http = yield* HttpClient.HttpClient
  const req = HttpClientRequest.get(modelsUrl(r)).pipe(
    HttpClientRequest.bearerToken(Redacted.value(r.key)),
  )
  return yield* http.execute(req).pipe(
    Effect.timeout(TIMEOUT_MS),
    Effect.map((res) => ({
      name: 'jev',
      ok: res.status < 400,
      detail: `${where}: GET /v1/models HTTP ${res.status}`,
    })),
    Effect.catch((e) =>
      Effect.succeed({ name: 'jev', ok: false, detail: `${where}: GET /v1/models ${e._tag}` }),
    ),
  )
}).pipe(Effect.orDie)
