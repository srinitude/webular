// Shared HTTP and date window for the fresh task generator. Every request
// sends a polite User-Agent, has a timeout, and retries twice with a jittered backoff.
import { Effect, Schedule, Schema } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import { BUILD_DATE } from './generate-common.ts'

const UA = 'webular-bench-generator/1.0 (kiren@fantasymetals.com)'
const DAY = 86_400_000

// Inclusive window: the build date and the 90 days before it.
export const WINDOW_START = new Date(Date.parse(BUILD_DATE) - 90 * DAY).toISOString().slice(0, 10)
export const EXPIRES = new Date(Date.parse(BUILD_DATE) + 90 * DAY).toISOString().slice(0, 10)
export const inWindow = (iso: string) => {
  const day = iso.slice(0, 10)
  return day >= WINDOW_START && day <= BUILD_DATE
}

export const getText = (url: string, accept = '*/*') =>
  Effect.gen(function* () {
    const http = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
    const res = yield* http.get(url, { headers: { 'User-Agent': UA, Accept: accept } })
    return yield* res.text
  }).pipe(
    Effect.timeout('30 seconds'),
    Effect.retry({ times: 2, schedule: Schedule.exponential('2 seconds').pipe(Schedule.jittered) }),
  )

export const getJson = <S extends Schema.Top>(url: string, schema: S) =>
  getText(url, 'application/json').pipe(
    Effect.flatMap((t) => Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(t)),
  )
