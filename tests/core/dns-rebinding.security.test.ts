// DNS rebinding: a name that answers public on the guard's lookup and private on the
// next one is a private target (docs/commands.md#private-addresses).
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { guardTarget } from '../../src/core/address-guard.ts'
import { httpGet } from '../../src/core/http.ts'
import { eff } from '../_support/run.ts'

const answer = (address: string) => [{ address, family: 4 as const, ttl: 0 }]
afterEach(() => mock.restore())

// Each lookup of the name gets the next answer: public first, then loopback.
const rebound = <A, E>(body: Effect.Effect<A, E>, env: Record<string, string>) =>
  Effect.suspend(() => {
    spyOn(Bun.dns, 'lookup')
      .mockResolvedValueOnce(answer('8.8.8.8'))
      .mockResolvedValue(answer('127.0.0.1'))
    const config = ConfigProvider.fromUnknown(env)
    return Effect.result(Effect.provideService(body, ConfigProvider.ConfigProvider, config))
  })
const AGENT = { WEBULAR_AGENT_MODE: '1' }
const TARGET = 'http://rebind.example/'

const tagIs = (env: Record<string, string>, tag: 'Success' | 'Failure') =>
  eff(Effect.map(rebound(guardTarget(TARGET), env), (r) => expect(r._tag).toBe(tag)))

describe('DNS rebinding', () => {
  test('agent mode blocks a name that switches to a private address', tagIs(AGENT, 'Failure'))
  test('a CLI-typed target that switches stays allowed', tagIs({}, 'Success'))
  test(
    'agent mode with WEBULAR_ALLOW_PRIVATE=1 allows it',
    tagIs({ ...AGENT, WEBULAR_ALLOW_PRIVATE: '1' }, 'Success'),
  )
  test(
    'the fetch fails at the guard and never connects',
    eff(
      Effect.map(rebound(httpGet(TARGET), AGENT), (r) => {
        expect(r._tag).toBe('Failure')
        if (r._tag === 'Failure') expect(r.failure.message).toContain('private address')
      }),
    ),
  )
})
