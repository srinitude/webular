// SSRF guard: private, loopback, and link-local targets (docs/commands.md#private-addresses).
import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { guardTarget, isPrivateIp } from '../../src/core/address-guard.ts'
import { fetchRoot, httpGet } from '../../src/core/http.ts'
import { makeFetchLayer } from '../../src/lib/fetch-layer.ts'
import { fetchSources } from '../../src/lib/sources.ts'
import { eff } from '../_support/run.ts'

const PRIVATE = [
  '10.0.0.1',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.1.1',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254',
  '100.64.0.1',
  '::1',
  '::',
  'fc00::1',
  'fd12:3456::1',
  'fe80::1',
  '::ffff:127.0.0.1',
  '::ffff:169.254.169.254',
  '::ffff:7f00:1',
  '::ffff:a00:1',
  '[::1]',
  '64:ff9b::a9fe:a9fe',
  '64:ff9b::127.0.0.1',
  '::7f00:1',
  '::a9fe:a9fe',
]
const PUBLIC = [
  '8.8.8.8',
  '1.1.1.1',
  '172.32.0.1',
  '192.169.0.1',
  '2606:4700::1111',
  '::ffff:8.8.8.8',
  '64:ff9b::808:808',
]

// env is the whole ConfigProvider, so the outer process env never leaks in.
const tagOf = <A, E>(body: Effect.Effect<A, E>, env: Record<string, string> = {}) =>
  Effect.map(
    Effect.result(
      Effect.provideService(body, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
    ),
    (r) => r._tag,
  )
const AGENT = { WEBULAR_AGENT_MODE: '1' }

describe('isPrivateIp', () => {
  for (const ip of PRIVATE) test(`private: ${ip}`, () => expect(isPrivateIp(ip)).toBe(true))
  for (const ip of PUBLIC) test(`public: ${ip}`, () => expect(isPrivateIp(ip)).toBe(false))
})

const expectTag = <A, E>(
  body: Effect.Effect<A, E>,
  env: Record<string, string>,
  tag: 'Success' | 'Failure',
) => eff(Effect.map(tagOf(body, env), (t) => expect(t).toBe(tag)))

describe('guardTarget', () => {
  test(
    'a private target typed on the CLI is allowed',
    expectTag(guardTarget('http://127.0.0.1:1/'), {}, 'Success'),
  )
  test(
    'agent mode blocks the cloud metadata address',
    expectTag(guardTarget('http://169.254.169.254/latest/meta-data/'), AGENT, 'Failure'),
  )
  test(
    'agent mode with WEBULAR_ALLOW_PRIVATE=1 allows a private target',
    expectTag(guardTarget('http://[::1]:1/'), { ...AGENT, WEBULAR_ALLOW_PRIVATE: '1' }, 'Success'),
  )
  test(
    'a redirect from a public origin to a private address is blocked',
    expectTag(
      guardTarget('http://10.0.0.5/', { url: 'http://8.8.8.8/', originPrivate: false }),
      {},
      'Failure',
    ),
  )
  test(
    'a redirect from https to http is blocked',
    expectTag(
      guardTarget('http://127.0.0.1/', { url: 'https://127.0.0.1/', originPrivate: true }),
      {},
      'Failure',
    ),
  )
})

// End to end through the shared fetch path (src/core/http.ts).
const serve = (fetch: (req: Request) => Response) =>
  Effect.acquireRelease(
    Effect.sync(() => Bun.serve({ port: 0, maxRequestBodySize: 1024, fetch })),
    (s) => Effect.sync(() => s.stop(true)),
  )
const hop = (req: Request) =>
  new URL(req.url).pathname === '/hop'
    ? Response.redirect(new URL('/end', req.url).toString(), 302)
    : new Response('ok')

describe('httpGet', () => {
  test(
    'a CLI-direct private origin follows its own redirect',
    eff(
      Effect.flatMap(serve(hop), (s) =>
        Effect.map(tagOf(httpGet(`http://127.0.0.1:${s.port}/hop`)), (t) =>
          expect(t).toBe('Success'),
        ),
      ),
    ),
  )
  test(
    'agent mode blocks a private origin',
    eff(
      Effect.flatMap(serve(hop), (s) =>
        Effect.map(tagOf(httpGet(`http://127.0.0.1:${s.port}/hop`), AGENT), (t) =>
          expect(t).toBe('Failure'),
        ),
      ),
    ),
  )
  test(
    'fetchRoot fails when the root redirects to another host',
    eff(
      Effect.gen(function* () {
        const end = yield* serve(hop)
        const root = yield* serve(() => Response.redirect(`http://127.0.0.1:${end.port}/end`, 302))
        const t = yield* tagOf(fetchRoot(`http://localhost:${root.port}/`))
        expect(t).toBe('Failure')
      }),
    ),
  )
})

// The answer/research page client (src/lib/fetch-layer.ts) checks each redirect hop too.
const page = (url: string, env: Record<string, string> = {}) =>
  tagOf(
    Effect.scoped(Effect.flatMap(makeFetchLayer({ cachePath: ':memory:' }), (f) => f(url))),
    env,
  )

describe('fetch layer', () => {
  test(
    'a CLI-direct private origin follows its own redirect',
    eff(
      Effect.flatMap(serve(hop), (s) =>
        Effect.map(page(`http://127.0.0.1:${s.port}/hop`), (t) => expect(t).toBe('Success')),
      ),
    ),
  )
  test(
    'agent mode blocks a private origin',
    eff(
      Effect.flatMap(serve(hop), (s) =>
        Effect.map(page(`http://127.0.0.1:${s.port}/hop`, AGENT), (t) => expect(t).toBe('Failure')),
      ),
    ),
  )
})

// answer/research: a private link found on a search result page is dropped; a typed --urls one is read.
describe('fetchSources', () => {
  const reasons = (typed: boolean) =>
    Effect.flatMap(serve(hop), (s) =>
      Effect.map(
        fetchSources([{ title: 't', url: `http://127.0.0.1:${s.port}/end` }], 5_000, 1_000, typed),
        (out) => out.errors.map((e) => e.reason).join(' '),
      ),
    )
  test(
    'a private link on a result page is blocked',
    eff(Effect.map(reasons(false), (r) => expect(r).toContain('blocked'))),
  )
  test(
    'a private URL the user typed is read',
    eff(Effect.map(reasons(true), (r) => expect(r).not.toContain('blocked'))),
  )
})
