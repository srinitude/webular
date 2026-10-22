// What the bench worker child hands back to the runner: the adapter result on
// stdout, plus the request log its webular step runtime wrote.
import { Effect, FileSystem, Schema } from 'effect'
import { OutboundCall, Status } from './schema.ts'

export type Settings = 'default' | 'best'
// The shape every peer adapter (scripts/bench/peers/<provider>.ts) exports.
export interface Adapter {
  readonly provider: string
  readonly run: (input: string, settings: Settings) => Effect.Effect<AdapterResult, unknown>
}
const AdapterResult = Schema.Struct({
  results: Schema.Array(Schema.String),
  requestBody: Schema.String,
  status: Status,
  cached: Schema.Boolean,
  calls: Schema.Array(OutboundCall),
})
type AdapterResult = typeof AdapterResult.Type
export const WorkerOut = Schema.Struct({
  ...AdapterResult.fields,
  latencyMs: Schema.Number,
  cpuMs: Schema.Number,
})

const Requests = Schema.Array(
  Schema.fromJsonString(Schema.Struct({ method: Schema.String, url: Schema.String })),
)

// The child's webular step runtime appends each request to WEBULAR_REQUEST_LOG
// (src/workflows/runtime.ts); no file means the provider never ran webular code,
// so the row's requests stay unrecorded.
export const readRequests = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    if (!(yield* fs.exists(file))) return undefined
    const lines = (yield* fs.readFileString(file)).split('\n').filter((l) => l !== '')
    return yield* Schema.decodeUnknownEffect(Requests)(lines)
  })
