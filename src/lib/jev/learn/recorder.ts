// Jev call recorder: one row per Jev call, every call, no sampling, so
// `webular jev learn` can see what works. A row holds hashes, kinds, picks,
// and numbers, never state text, so no page text or secret lands in the log.
// The log rotates at a byte cap and keeps a fixed number of rotated files.
// WEBULAR_JEV_CALLS=off turns it off.
import { Clock, Config, DateTime, Effect, FileSystem, Option } from 'effect'
import type { JevAnswer, JevRequest, JevResult } from '../client.ts'
import { askJev } from '../define.ts'
import type { JevError } from '../errors.ts'
import { cacheKey, canonical, confidenceOf } from '../payload/index.ts'
import { applyLessons, type LessonBook, readLessons } from './lessons.ts'

export interface CallRow {
  readonly id: string
  readonly at: string
  readonly decision: string
  readonly model: string | null
  readonly payloadHash: string
  readonly questionKinds: Record<string, string>
  readonly pick: Record<string, string | number | null>
  readonly confidence: number | null
  readonly latencyMs: number
  readonly inputTokens: number
  readonly codeCheck: 'pass' | 'fail' | null
  readonly fallback: boolean
  readonly source: string | null
  readonly lessons: ReadonlyArray<string>
}

interface RecorderConfig {
  readonly path: Option.Option<string>
  readonly lessonsPath: string
  readonly evalsDir: string
  readonly maxBytes: number
  readonly files: number
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_FILES = 5

const opt = (name: string) =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(() => Option.none<string>()))
const num = (o: Option.Option<string>, d: number) =>
  Option.match(o, { onNone: () => d, onSome: (s) => (Number(s) > 0 ? Number(s) : d) })

// $XDG_STATE_HOME/webular, else ~/.local/state/webular (the XDG default on
// macOS and Linux alike, so one path works in every shell).
export const recorderConfig = Effect.gen(function* () {
  // No state folder known (no HOME, USERPROFILE, XDG_STATE_HOME, or WEBULAR_STATE_DIR):
  // record nothing, so a test or sandbox never writes into its working folder.
  const profile = yield* opt('USERPROFILE') // Windows has no HOME
  const home = Option.orElse(yield* opt('HOME'), () => profile)
  const xdg = yield* opt('XDG_STATE_HOME')
  const own = yield* opt('WEBULAR_STATE_DIR')
  const known = Option.isSome(home) || Option.isSome(xdg) || Option.isSome(own)
  const base = Option.getOrElse(xdg, () => `${Option.getOrElse(home, () => '.')}/.local/state`)
  const dir = Option.getOrElse(own, () => `${base}/webular`)
  const off = Option.contains(yield* opt('WEBULAR_JEV_CALLS'), 'off')
  const file = Option.getOrElse(
    yield* opt('WEBULAR_JEV_CALLS_FILE'),
    () => `${dir}/jev-calls.jsonl`,
  )
  return {
    path: off || !known ? Option.none() : Option.some(file),
    lessonsPath: `${dir}/jev-lessons.json`,
    evalsDir: `${dir}/jev-evals`,
    maxBytes: num(yield* opt('WEBULAR_JEV_CALLS_MAX_BYTES'), DEFAULT_MAX_BYTES),
    files: num(yield* opt('WEBULAR_JEV_CALLS_FILES'), DEFAULT_FILES),
  } satisfies RecorderConfig
})

export const dirOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/'))) || '.'

// Shifts path -> path.1 -> ... -> path.<files>; the oldest is dropped.
// ponytail: stat-then-rename is not atomic across processes; two writers can
// rotate twice. Use a lock file if several webular processes share one log.
const rotate = (fs: FileSystem.FileSystem, path: string, maxBytes: number, files: number) =>
  Effect.gen(function* () {
    const size = yield* fs.stat(path).pipe(
      Effect.map((i) => Number(i.size)),
      Effect.orElseSucceed(() => 0),
    )
    if (size < maxBytes) return
    yield* fs.remove(`${path}.${files}`).pipe(Effect.ignore)
    for (let i = files - 1; i >= 1; i--)
      yield* fs.rename(`${path}.${i}`, `${path}.${i + 1}`).pipe(Effect.ignore)
    yield* fs.rename(path, `${path}.1`).pipe(Effect.ignore)
  })

// Appends one row; never fails, so a full disk never breaks a decision.
const appendRow = (fs: FileSystem.FileSystem, cfg: RecorderConfig) => (row: CallRow) =>
  Option.match(cfg.path, {
    onNone: () => Effect.void,
    onSome: (path) =>
      fs
        .makeDirectory(dirOf(path), { recursive: true })
        .pipe(
          Effect.andThen(rotate(fs, path, cfg.maxBytes, cfg.files)),
          Effect.andThen(fs.writeFileString(path, `${JSON.stringify(row)}\n`, { flag: 'a' })),
          Effect.ignore,
        ),
  })

const pickOf = (a: JevAnswer): string | number | null => a.choice ?? a.score ?? a.noul ?? null

interface RowMeta {
  readonly at: string
  readonly t0: number
  readonly t1: number
  readonly lessons: ReadonlyArray<string>
}

const rowOf = (
  decision: string,
  req: JevRequest,
  res: JevResult | undefined,
  meta: RowMeta,
): CallRow => {
  const hash = cacheKey(canonical(req)).toString(16)
  const answers = Object.entries(res?.answers ?? {})
  return {
    id: `${meta.t0.toString(36)}-${hash}`,
    at: meta.at,
    decision,
    model: res?.model ?? null,
    payloadHash: hash,
    questionKinds: Object.fromEntries(Object.entries(req.questions).map(([k, q]) => [k, q.type])),
    pick: Object.fromEntries(answers.map(([k, a]) => [k, pickOf(a)])),
    confidence: answers.length ? Math.min(...answers.map(([, a]) => confidenceOf(a))) : null,
    latencyMs: meta.t1 - meta.t0,
    inputTokens: res?.inputTokens ?? 0,
    codeCheck: null,
    fallback: res === undefined,
    source: res?.source ?? null,
    lessons: meta.lessons,
  }
}

interface AskService {
  readonly available: boolean
  readonly ask: (decision: string, req: JevRequest) => Effect.Effect<JevResult, JevError>
}

const finish = (
  write: (row: CallRow) => Effect.Effect<void>,
  decision: string,
  req: JevRequest,
  t0: number,
  lessons: ReadonlyArray<string>,
) =>
  Effect.fnUntraced(function* (res: JevResult | undefined) {
    const t1 = yield* Clock.currentTimeMillis
    const at = DateTime.formatIso(yield* DateTime.now)
    yield* write(rowOf(decision, req, res, { at, t0, t1, lessons }))
  })

const recordedAsk = (
  svc: AskService,
  book: LessonBook,
  write: (row: CallRow) => Effect.Effect<void>,
) =>
  Effect.fnUntraced(function* (decision: string, req0: JevRequest) {
    const kinds = (book[decision] ?? []).map((l) => l.kind)
    const req = applyLessons(req0, kinds)
    const done = finish(write, decision, req, yield* Clock.currentTimeMillis, kinds)
    return yield* askJev(svc, decision, req).pipe(
      Effect.tap((r) => done(r)),
      Effect.tapError(() => done(undefined)),
    )
  })

// Wraps the Jev service: kept lessons reshape each payload at once, and every
// call, answered or failed, gets one row.
export const withRecorder = <S extends AskService>(svc: S, book?: LessonBook) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const cfg = yield* recorderConfig
    const lessons = book ?? (yield* readLessons(fs, cfg.lessonsPath))
    return { ...svc, ask: recordedAsk(svc, lessons, appendRow(fs, cfg)) } as S
  })
