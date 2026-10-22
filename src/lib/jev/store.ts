// Where Jev answers live: the in-memory LRU, record and replay files, the
// calibration log, and the drift file. client.ts wires these into `ask`.
import { DateTime, Effect, type FileSystem, Option, Schema } from 'effect'
import type { JevRequest, JevResult } from './client.ts'
import type { JevError } from './errors.ts'
import { JEV_LATEST_RELEASED } from './model.ts'
import { cacheKey, isSure, requestBytes } from './payload/index.ts'
import { Result } from './post.ts'

// The versioned id the calibration evals (tests/jev/decisions.eval.test.ts)
// were recorded with: the model every call sends. Each log row names the model
// that answered, so rows from different models never mix. Any other answering id
// is drift: the log row says so, WEBULAR_JEV_DRIFT_FILE gets a line, and
// `mise run jev:check` reruns the evals live.
export const JEV_CALIBRATED_MODEL = JEV_LATEST_RELEASED
export const modelDrift = (model: string | undefined, calibrated: string = JEV_CALIBRATED_MODEL) =>
  model !== undefined && model !== calibrated

const append = (fs: FileSystem.FileSystem, path: string, row: unknown) =>
  fs.writeFileString(path, `${JSON.stringify(row)}\n`, { flag: 'a' }).pipe(Effect.ignore)

// Calibration log: one JSON line per call, so thresholds can be tuned against
// outcomes. Off unless WEBULAR_JEV_LOG names a file. It holds the request hash
// and the answers, never the state, so page text never lands in a log.
export const logCalibration = (fs: FileSystem.FileSystem, path: Option.Option<string>) =>
  Effect.fnUntraced(function* (decision: string, key: bigint, res: JevResult) {
    if (Option.isNone(path)) return
    const at = DateTime.formatIso(yield* DateTime.now)
    const { model, source, answers, inputTokens } = res
    const sure = isSure(answers) // the 99%-at-0.95 metric reads this field
    const drift = source === 'jev' && modelDrift(model)
    yield* append(fs, path.value, {
      at,
      decision,
      model,
      source,
      sure,
      request: key.toString(16),
      answers,
      inputTokens,
      drift,
    })
  })

// One line per drifted answer, so `jev:check` knows the calibration is stale.
export const flagDrift = (fs: FileSystem.FileSystem, path: Option.Option<string>) =>
  Effect.fnUntraced(function* (decision: string, res: JevResult) {
    if (Option.isNone(path) || res.source !== 'jev' || !modelDrift(res.model)) return
    yield* append(fs, path.value, { decision, model: res.model, calibrated: JEV_CALIBRATED_MODEL })
  })

const decodeResult = Schema.decodeUnknownEffect(Schema.fromJsonString(Result))

// Record and replay: with WEBULAR_JEV_REPLAY=<dir>, each answer lives in
// <dir>/<hash>.json. A hit never calls the API. A miss calls it only when
// WEBULAR_JEV_RECORD=1; otherwise it is a defect, which no fallback swallows,
// so CI fails instead of paying quietly. Every CI call is billed once.
export const replayStore = (fs: FileSystem.FileSystem, dir: string, record: boolean) => ({
  get: (k: bigint) =>
    fs.readFileString(`${dir}/${k.toString(16)}.json`).pipe(
      Effect.flatMap(decodeResult),
      Effect.map((r): Option.Option<JevResult> => Option.some({ ...r, source: 'replay' })),
      Effect.orElseSucceed(() => Option.none<JevResult>()),
    ),
  miss: (k: bigint, live: Effect.Effect<JevResult, JevError>) => {
    const file = `${dir}/${k.toString(16)}.json`
    const save = (r: JevResult) =>
      fs
        .makeDirectory(dir, { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(file, JSON.stringify(r))), Effect.ignore)
    return record
      ? live.pipe(Effect.tap(save))
      : Effect.die(
          new Error(`Jev replay miss ${k.toString(16)}: record it with WEBULAR_JEV_RECORD=1`),
        )
  },
})

// LRU keyed by the hash of the canonical request bytes: the same payload
// never pays for a second call. Map keeps insertion order and a hit
// re-inserts its key, so the first key is always the coldest one: O(1).
export const makeLru = (capacity: number) => {
  const lru = new Map<bigint, JevResult>()
  const remember = (k: bigint, res: JevResult) =>
    Effect.sync(() => {
      lru.delete(k)
      lru.set(k, res)
      if (lru.size > capacity) lru.delete(lru.keys().next().value as bigint)
    })
  return { get: (k: bigint) => lru.get(k), remember }
}

interface AskDeps {
  readonly model: string
  readonly replay: Option.Option<ReturnType<typeof replayStore>>
  readonly live: (body: string) => Effect.Effect<JevResult, JevError>
  readonly lru: ReturnType<typeof makeLru>
  readonly log: ReturnType<typeof logCalibration>
  readonly drift: ReturnType<typeof flagDrift>
}

// Cache, then replay, then the live call; every answer is remembered, logged, and drift-checked.
export const makeAsk = (d: AskDeps) => (decision: string, req: JevRequest) =>
  Effect.suspend(() => {
    const body = requestBytes(d.model, req.state, req.questions, req.assets)
    const k = cacheKey(body)
    const hit = d.lru.get(k)
    const fromReplay = (r: ReturnType<typeof replayStore>) => {
      const onNone = () => r.miss(k, d.live(body))
      return r.get(k).pipe(Effect.flatMap(Option.match({ onNone, onSome: Effect.succeed })))
    }
    const res: Effect.Effect<JevResult, JevError> = hit
      ? Effect.succeed({ ...hit, source: 'cache' as const })
      : Option.match(d.replay, { onNone: () => d.live(body), onSome: fromReplay })
    return res.pipe(
      Effect.tap((r) => d.lru.remember(k, r)),
      Effect.tap((r) => d.log(decision, k, r)),
      Effect.tap((r) => d.drift(decision, r)),
    )
  })
