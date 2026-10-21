// A 304 hit stamps the entry with the current time. Node's utimes reads a bare
// number as seconds, so a millisecond count lands near year 58000: NTFS rejects
// it (the touch is lost and the entry is evicted early), other systems accept it.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Clock, ConfigProvider, Effect, FileSystem, Layer, Option } from 'effect'
import { cachedGetText } from '../../src/core/cache.ts'

const responses = [
  () => new Response('body', { headers: { etag: '"t"' } }),
  () => new Response(null, { status: 304 }),
]

test('a 304 hit sets the entry mtime to now, not a far-future date', () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'webular-touch-' })
        const provider = ConfigProvider.fromEnvRecord({ WEBULAR_CACHE_DIR: dir })
        let call = 0
        const fetchText = cachedGetText(
          'https://touch.test/a',
          () => Effect.sync(() => responses[call++]?.() ?? new Response(null, { status: 500 })),
          (res) => Effect.promise(() => res.text()),
        ).pipe(Effect.provide(Layer.merge(ConfigProvider.layer(provider), BunServices.layer)))
        yield* fetchText
        expect(yield* fetchText).toBe('body')
        const [name] = yield* fs.readDirectory(dir)
        const info = yield* fs.stat(`${dir}/${name}`)
        const mtime = Option.match(info.mtime, { onNone: () => 0, onSome: (d) => d.getTime() })
        const now = yield* Clock.currentTimeMillis
        expect(Math.abs(mtime - now)).toBeLessThan(60_000)
      }),
    ).pipe(Effect.provide(BunServices.layer)),
  ))
