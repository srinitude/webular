// Request shape and retry contracts: text cuts never split a UTF-16 surrogate
// pair, and a 200 reply that does not decode is never paid for twice.
import { expect, test } from 'bun:test'
import { Effect, Option, Redacted } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'
import { committedSnapshot } from '../../src/lib/jev/docs-guard.ts'
import { JEV_LATEST_RELEASED } from '../../src/lib/jev/model.ts'
import { CAPS, canonical, requestBytes } from '../../src/lib/jev/payload/index.ts'
import { postOnce, withRetry } from '../../src/lib/jev/post.ts'
import { eff } from '../_support/run.ts'

// JSON.stringify writes a valid pair raw and escapes only a lone surrogate.
const wellFormed = (json: string) => json.isWellFormed() && !/\\ud[89a-f][0-9a-f]{2}/i.test(json)
const noul = { q: { type: 'noul' as const, instructions: 'i' } }

test('the string cap never cuts a surrogate pair in half', () => {
  expect(wellFormed(canonical({ text: `${'a'.repeat(CAPS.chars - 1)}😀 tail` }))).toBe(true)
})

test('the key cap never cuts a surrogate pair in half', () => {
  expect(wellFormed(canonical({ [`${'k'.repeat(CAPS.keyChars - 1)}😀`]: 1 }))).toBe(true)
})

test('the byte-budget cut never cuts a surrogate pair in half', () => {
  const big = '😀'.repeat(CAPS.chars / 2)
  const state = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, `x${big}`]))
  expect(wellFormed(requestBytes(JEV_LATEST_RELEASED, state, noul))).toBe(true)
})

test('text cut short upstream is sent as well-formed UTF-16', () => {
  expect(wellFormed(canonical({ text: 'abc😀'.slice(0, 4) }))).toBe(true)
})

// A fake Jev endpoint that answers every POST with one status and body.
const fakeJev = (status: number, reply: string, bodies: string[]) =>
  HttpClient.make((req) =>
    Effect.sync(() => {
      bodies.push(req.body._tag === 'Uint8Array' ? new TextDecoder().decode(req.body.body) : '')
      return HttpClientResponse.fromWeb(req, new Response(reply, { status }))
    }),
  )
const postTo = (http: HttpClient.HttpClient) =>
  withRetry(
    postOnce('https://jev.test/v1/systemone', http, Option.some(Redacted.make('test-key')), {
      snapshot: committedSnapshot,
      checkedAt: Number.MAX_SAFE_INTEGER, // fresh: no docs fetch in this test
    }),
  )
const body = requestBytes(JEV_LATEST_RELEASED, { a: 1 }, noul)

test(
  'a 200 reply that does not decode is not retried, so it is billed once',
  eff(
    Effect.gen(function* () {
      const bodies: string[] = []
      const err = yield* Effect.flip(postTo(fakeJev(200, '{"unexpected":true}', bodies))(body))
      expect(err.kind).toBe('bad_reply')
      expect(bodies).toHaveLength(1)
    }),
  ),
)

test(
  'a 529 is retried once with the same body and model',
  eff(
    Effect.gen(function* () {
      const bodies: string[] = []
      const err = yield* Effect.flip(postTo(fakeJev(529, '', bodies))(body))
      expect(err.kind).toBe('server')
      expect(bodies).toEqual([body, body])
    }),
  ),
)
