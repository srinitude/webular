// The live peer benchmark set: hand-checked rows from peers-seed.json, seven
// categories, all in the dev split, since every peer runs every task live.
// Each row's gold was fetched on its build date; rerun manifest.ts after.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { SetTask } from '../schema.ts'
import { jsonl } from './generate-common.ts'
import seed from './peers-seed.json'

const Rows = Schema.Array(SetTask)
const decodeRows = Schema.decodeUnknownEffect(Rows)

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const rows = yield* decodeRows(seed)
  yield* fs.writeFileString(`${process.cwd()}/bench/tasks/dev/peers.jsonl`, jsonl(rows))
})

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
