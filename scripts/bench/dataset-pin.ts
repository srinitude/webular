// mise run bench:data:pin: write bench/datasets/<set>.json from the cached files.
// Run it after a revision bump, with the new file already in the cache. The set table
// below is the one place that names a repo, revision, file, and sample size.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem } from 'effect'
import { CACHE, MANIFESTS } from './dataset-fetch.ts'
import { type DatasetManifest, records, sample, sha256 } from './dataset-manifest.ts'

type Pin = Omit<DatasetManifest, 'bytes' | 'sha256' | 'rows'> & { readonly take: number }

const SETS: ReadonlyArray<Pin> = [
  {
    set: 'webmainbench',
    repo: 'opendatalab/WebMainBench',
    revision: '5da0972e9b58d0c7891ae75053ced97c268f52e3',
    file: 'WebMainBench_545.jsonl',
    format: 'jsonl',
    idField: 'track_id',
    license: 'Apache-2.0 (labels only; the pages stay under their owners)',
    subset:
      "The authors' 545-row subset file, not the 1.46 GB full set. Rows are ranked by sha256 of track_id and the first 100 are kept.",
    take: 100,
  },
  {
    set: 'firecrawl-scrape',
    repo: 'firecrawl/scrape-content-dataset-v1',
    revision: 'aad2b002cd74147236ee6fb4fd7e2bcf28955c3c',
    file: '1-0-0.csv',
    format: 'csv',
    idField: 'id',
    license: 'MIT (labels only; the pages stay under their owners)',
    subset: 'All rows of the single file (1000 URLs).',
    take: Number.POSITIVE_INFINITY,
  },
]

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  yield* fs.makeDirectory(MANIFESTS, { recursive: true })
  for (const { take, ...pin } of SETS) {
    const bytes = yield* fs.readFile(`${CACHE}/${pin.set}/${pin.file}`)
    const all = yield* records(pin.format, pin.idField, new TextDecoder().decode(bytes))
    const rows = sample(all, take).map(({ id, url, sha256: hash }) => ({ id, url, sha256: hash }))
    const manifest: DatasetManifest = {
      ...pin,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      rows,
    }
    yield* fs.writeFileString(
      `${MANIFESTS}/${pin.set}.json`,
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    yield* Console.log(`bench:data:pin ${pin.set} ${rows.length} of ${all.length} rows`)
  }
})

BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
