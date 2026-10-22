// The Jev key lookup: TYPESAFE_API_KEY works on every system, and the macOS
// Keychain CLI runs only on darwin, never under CI, and for at most 3 seconds;
// elsewhere it is skipped with no spawn.
import { afterEach, expect, test } from 'bun:test'
import { ConfigProvider, Effect, Fiber, Layer, Option, Redacted } from 'effect'
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner'
import { TestClock } from 'effect/testing'
import { resolveKey } from '../../src/lib/jev/client.ts'

const real = process.platform
const setPlatform = (value: string) => Object.defineProperty(process, 'platform', { value })
afterEach(() => setPlatform(real))

const check = (platform: string, env: Record<string, string>, want: object) => {
  setPlatform(platform)
  let spawned = 0
  const spawner = {
    string: () =>
      Effect.sync(() => {
        spawned++
        return 'from-keychain'
      }),
  }
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

test('darwin under CI: no Keychain spawn, so CI never blocks on it', () =>
  check('darwin', { CI: 'true' }, { key: Option.none(), spawned: 0 }))

test('darwin: a Keychain lookup that never answers counts as no key after 3 seconds', () => {
  setPlatform('darwin')
  const spawner = { string: () => Effect.never }
  return Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(resolveKey)
      yield* TestClock.adjust('3 seconds')
      const key = yield* Fiber.join(fiber)
      expect(Option.isNone(key)).toBe(true)
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          TestClock.layer(),
          Layer.succeed(ChildProcessSpawner, spawner as never),
          ConfigProvider.layer(ConfigProvider.fromUnknown({})),
        ),
      ),
    ),
  )
})
