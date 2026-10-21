// Docs snapshot cache: the last verified snapshot and when it was checked, kept on
// disk, so a check still fresh in a new process skips the network.
import { Clock, Config, Effect, FileSystem, Option, Schema } from 'effect'
import { type DocsRefused, type Fetcher, type GuardLog, refresh } from './docs-fetch.ts'
import type { DecisionModel, DocsSnapshot } from './docs-snapshot.ts'

// ponytail: one fixed hour for every model; make it a setting if docs change faster.
const DOCS_TTL_MS = 60 * 60 * 1000

const Snapshot = Schema.Struct({
  model: Schema.String,
  url: Schema.String,
  etag: Schema.optional(Schema.String),
  lastModified: Schema.optional(Schema.String),
  sha256: Schema.String,
  lines: Schema.Number,
  chunks: Schema.Array(Schema.Tuple([Schema.Number, Schema.Number])),
  limits: Schema.Struct({
    bodyBytes: Schema.Number,
    nesting: Schema.Number,
    choiceMax: Schema.Number,
    scoreMin: Schema.Number,
    scoreMax: Schema.Number,
    types: Schema.Array(Schema.String),
  }),
  verified: Schema.Boolean,
})
const Cached = Schema.Struct({ checkedAt: Schema.Number, snapshot: Snapshot })
type Cached = { readonly checkedAt: number; readonly snapshot: DocsSnapshot }
const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Cached))

interface DocsStore {
  readonly load: Effect.Effect<Option.Option<Cached>>
  readonly save: (c: Cached) => Effect.Effect<void>
}
export interface DocsState {
  snapshot: DocsSnapshot | undefined
  checkedAt?: number
  readonly store?: DocsStore
}

// Temp file then rename, so a process reading at the same time never sees half a file.
// A cache read or write that fails only skips the cache.
export const fileStore = (fs: FileSystem.FileSystem, file: string): DocsStore => ({
  load: fs.readFileString(file).pipe(Effect.flatMap(decode), Effect.option),
  save: (c) => {
    const tmp = `${file}.${process.pid}.tmp`
    return fs
      .writeFileString(tmp, JSON.stringify(c))
      .pipe(Effect.andThen(fs.rename(tmp, file)), Effect.ignore)
  },
})

// WEBULAR_CACHE_DIR/jev-docs.json (default ~/.cache/webular), next to the local index.
export const docsStore = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const home = yield* Config.String('HOME').pipe(Config.withDefault('.'), Effect.orDie)
  const dir = yield* Config.String('WEBULAR_CACHE_DIR')
    .pipe(Config.withDefault(`${home}/.cache/webular`))
    .pipe(Effect.orDie)
  yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.ignore)
  return fileStore(fs, `${dir}/jev-docs.json`)
})

const usable = (s: DocsSnapshot | undefined, model: DecisionModel): s is DocsSnapshot =>
  s?.verified === true && s.url === model.docs

const loadOnce = (state: DocsState, model: DecisionModel) =>
  Effect.gen(function* () {
    if (state.checkedAt !== undefined || state.store === undefined) return
    const disk = yield* state.store.load
    if (Option.isNone(disk) || !usable(disk.value.snapshot, model)) return
    state.snapshot = disk.value.snapshot
    state.checkedAt = disk.value.checkedAt
  })

// A snapshot checked within DOCS_TTL_MS is used as is; otherwise one conditional GET,
// and the result is written back (awaited) before the call goes on.
export const cachedRefresh = (
  model: DecisionModel,
  state: DocsState,
  get: Fetcher,
  log: (l: GuardLog) => Effect.Effect<void>,
): Effect.Effect<DocsSnapshot, DocsRefused> =>
  Effect.gen(function* () {
    yield* loadOnce(state, model)
    const now = yield* Clock.currentTimeMillis
    const fresh = state.checkedAt !== undefined && now - state.checkedAt < DOCS_TTL_MS
    if (fresh && usable(state.snapshot, model)) return state.snapshot
    const snap = yield* refresh(model, state.snapshot, get, log)
    state.checkedAt = now
    if (state.store) yield* state.store.save({ checkedAt: now, snapshot: snap })
    return snap
  })
