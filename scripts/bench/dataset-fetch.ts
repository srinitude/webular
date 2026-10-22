// mise run bench:data: download each pinned public dataset into the gitignored cache
// (.cache/bench-data/<set>/<file>) and check its sha256 against bench/datasets/<set>.json.
// A cached file with the right hash makes no network call. A wrong size or hash fails
// and writes nothing. The page content stays in the cache and never enters git.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import {
  DatasetError,
  type DatasetManifest,
  decodeManifest,
  refuse,
  sha256,
} from './dataset-manifest.ts'

const root = `${import.meta.dir}/../..`
export const MANIFESTS = `${root}/bench/datasets`
export const CACHE = `${root}/.cache/bench-data`
const LIMIT = '10 minutes'

export const sourceUrl = (m: DatasetManifest) =>
  `https://huggingface.co/datasets/${m.repo}/resolve/${m.revision}/${m.file}`

// One set: 'cached' when the file in the cache already matches, else 'fetched'.
// ponytail: the body is held in memory (largest set is about 110 MB); stream to disk if a set outgrows that.
export const fetchSet = (m: DatasetManifest, cache: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const http = yield* HttpClient.HttpClient
    const path = `${cache}/${m.set}/${m.file}`
    const have = yield* fs.readFile(path).pipe(
      Effect.map(sha256),
      Effect.orElseSucceed(() => ''),
    )
    if (have === m.sha256) return 'cached' as const
    const body = yield* Effect.gen(function* () {
      const res = yield* http.execute(HttpClientRequest.get(sourceUrl(m)))
      const size = Number(res.headers['content-length'] ?? m.bytes)
      if (res.status !== 200) return yield* refuse(`${m.set}: HTTP ${res.status}`)
      if (size !== m.bytes) return yield* refuse(`${m.set}: size ${size}, manifest says ${m.bytes}`)
      return new Uint8Array(yield* res.arrayBuffer)
    }).pipe(Effect.timeout(LIMIT))
    if (body.byteLength !== m.bytes || sha256(body) !== m.sha256)
      return yield* refuse(`${m.set}: sha256 differs from the manifest; nothing was written`)
    yield* fs.makeDirectory(`${cache}/${m.set}`, { recursive: true })
    yield* fs.writeFile(`${path}.part`, body)
    yield* fs.rename(`${path}.part`, path)
    return 'fetched' as const
  }).pipe(
    Effect.mapError((e) =>
      e instanceof DatasetError ? e : new DatasetError({ message: `${m.set}: ${String(e)}` }),
    ),
  )

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const names = (yield* fs.readDirectory(MANIFESTS)).filter((n) => n.endsWith('.json')).sort()
  for (const name of names) {
    const m = yield* decodeManifest(name, yield* fs.readFileString(`${MANIFESTS}/${name}`))
    yield* Console.log(`bench:data ${m.set} ${yield* fetchSet(m, CACHE)} (${m.rows.length} rows)`)
  }
})

if (import.meta.main)
  BunRuntime.runMain(main.pipe(Effect.provide([FetchHttpClient.layer, BunServices.layer])))
