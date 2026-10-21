// Every decision uses Jev's pick only when the call succeeds, the pick clears the
// 0.95 bar, and the code check passes; every other path runs the fallback.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Layer } from 'effect'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { JevError } from '../../src/lib/jev/errors.ts'

const page = { url: 'https://x.dev/', title: 'x' }
// The fallback rejects a login link, so any `true` below came from Jev.
const login = (url: string) => ({ goal: 'docs', page, link: { url, anchor: 'Sign in' } })
const stub = (ask: Jev['Service']['ask']) => Layer.succeed(Jev)(Jev.of({ available: true, ask }))
const sure = (noul: number) =>
  stub(() => Effect.succeed({ answers: { content: { noul } } } as unknown as JevResult))
const expectRun = (layer: Layer.Layer<Jev>, url: string, want: boolean) =>
  Effect.runPromise(
    decisions.link(login(url)).pipe(
      Effect.provide(layer),
      Effect.map((got) => expect(got).toBe(want)),
    ),
  )

test('a sure pick that passes the code check wins over the fallback', () => {
  expect(decisions.link.def.fallback(login('https://x.dev/login'))).toBe(false)
  return expectRun(sure(0.99), 'https://x.dev/login', true)
})

test('low confidence uses the fallback', () => expectRun(sure(0.8), 'https://x.dev/login', false))

test('a failed code check uses the fallback', () => {
  expect(decisions.link.def.codeCheck(true, login('ftp://x.dev/login'))).toBe(false)
  return expectRun(sure(0.99), 'ftp://x.dev/login', false)
})

test('a failed call uses the fallback', () =>
  expectRun(
    stub(() => Effect.fail(new JevError({ reason: 'down', kind: 'network' }))),
    'https://x.dev/login',
    false,
  ))

test('WEBULAR_JEV=off uses the fallback', () =>
  expectRun(
    Jev.live.pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ WEBULAR_JEV: 'off' }))),
    ),
    'https://x.dev/login',
    false,
  ))
