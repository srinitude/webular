// Writes bench/tasks/manifest.json: the set version plus the sha256 of every
// committed dev and test JSONL file, so loadSetFile can refuse edited bytes.
// Private files stay local and out of the manifest. Run after any generator.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { sha256 } from '../loader.ts'
import type { Manifest } from '../schema.ts'
import { BUILD_DATE } from './generate-common.ts'

const writeManifest = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const names = [...new Bun.Glob('{dev,test}/*.jsonl').scanSync({ cwd: dir })].sort()
    const texts = yield* Effect.forEach(names, (n) => fs.readFileString(`${dir}/${n}`), {
      concurrency: 8,
    })
    const files = Object.fromEntries(names.map((n, i) => [n, sha256(texts[i] ?? '')]))
    const manifest: Manifest = { version: BUILD_DATE, files }
    yield* fs.writeFileString(`${dir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)
    return manifest
  })

if (import.meta.main) {
  BunRuntime.runMain(
    writeManifest(`${process.cwd()}/bench/tasks`).pipe(Effect.provide(BunServices.layer)),
  )
}
