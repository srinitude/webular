// The Jev key lookup: TYPESAFE_API_KEY works on every system, and the macOS
// Keychain CLI runs only on darwin; elsewhere it is skipped with no spawn.
import { afterEach, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Layer, Option, Redacted } from 'effect'
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner'
import { resolveKey } from '../../src/lib/jev/client.ts'

const real = process.platform
const setPlatform = (value: string) => Object.defineProperty(process, 'platform', { value })
afterEach(() => setPlatform(real))

const check = (platform: string, env: Record<string, string>, want: object) => {
  setPlatform(platform)
  let spawned = 0
  const spawner = { string: () => Effect.sync(() => (spawned++, 'from-keychain')) }
  return Effect.runPromise(
    resolveKey.pipe(
      Effect.map((key) =>
        expect({ key: Option.map(key, Redacted.value), spawned }).toEqual(want as never),
      ),
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(ChildProcessSpawner, spawner as never),
          ConfigProvider.layer(ConfigProvider.fromUnknown(env)),
        ),
      ),
    ),
  )
}

for (const platform of ['linux', 'win32']) {
  test(`${platform}: no key means no Keychain spawn and no error`, () =>
    check(platform, {}, { key: Option.none(), spawned: 0 }))
  test(`${platform}: TYPESAFE_API_KEY is used`, () =>
    check(platform, { TYPESAFE_API_KEY: 'env-key' }, { key: Option.some('env-key'), spawned: 0 }))
}

test('darwin: the Keychain is read when the env var is absent', () =>
  check('darwin', {}, { key: Option.some('from-keychain'), spawned: 1 }))
