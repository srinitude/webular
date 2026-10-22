// The search step runs the local index beside the web round and still fuses
// [maker products, web, local] in that order, so the result list is unchanged.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, Schema } from 'effect'
import { addPages, fuseRanked, openLocalIndex } from '../../src/lib/local-index.ts'
import { localIndexPath } from '../../src/lib/local-index-path.ts'
import { runInProcess } from '../_support/cli.ts'
import { eff, tmpDir } from '../_support/run.ts'

const tides = {
  url: 'https://a.test/tides',
  title: 'Tidal Power in the Bay of Fundy',
  text: 'The Bay of Fundy has the highest tides on Earth, with a range that can reach 16 metres.',
}
const Out = Schema.fromJsonString(
  Schema.Struct({ results: Schema.Array(Schema.Struct({ url: Schema.String })) }),
)

test(
  'search fuses the concurrent local index in the serial order',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('search-fused-')
      const cache = { WEBULAR_NO_CACHE: '0', WEBULAR_CACHE_DIR: dir }
      yield* Effect.scoped(
        Effect.flatMap(Effect.flatMap(localIndexPath, openLocalIndex), (i) => addPages(i, [tides])),
      ).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(cache))))
      // A closed port: every web source fails, with no network.
      const env = {
        ...cache,
        WEBULAR_SOURCE_ORIGIN: 'http://127.0.0.1:1',
        WEBULAR_SOURCE_GAP_MS: '0',
      }
      const run = yield* runInProcess('src/commands/search.ts', ['Fundy tides', '--json'], { env })
      const out = yield* Schema.decodeUnknownEffect(Out)(run.out)
      const urls = out.results.map((r) => r.url)
      const web = urls.filter((u) => u !== tides.url).map((url) => ({ url }))
      const serial = fuseRanked([[], web, [{ url: tides.url }]]).map((r) => r.url)
      expect(urls).toContain(tides.url)
      expect(urls).toEqual(serial)
    }).pipe(Effect.scoped, Effect.provide(BunServices.layer)),
  ),
  60_000,
)
