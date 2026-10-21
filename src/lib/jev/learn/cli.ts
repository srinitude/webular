// `webular jev learn` and `webular jev correct <call-id> <right-answer> [--input <file.json>]`
// (the input file holds the decision input as one line of JSON); src/commands/jev.ts runs them.
// learn: summarizes the call log per decision, then tries each lesson on the
// decision's eval cases through the replay cache (WEBULAR_JEV_REPLAY; a miss
// calls Jev only with WEBULAR_JEV_RECORD=1) and writes the kept lessons.
// correct: turns one recorded call into a labeled eval case.
import { Console, Effect, FileSystem } from 'effect'
import { Jev } from '../client.ts'
import { decisions } from '../decisions.ts'
import type { DecisionDef } from '../define.ts'
import {
  correct,
  type EvalCase,
  evalsPath,
  type Learnable,
  learnDecision,
  readLessons,
  readRows,
  summarize,
  writeLessons,
} from './lessons.ts'
import { type CallRow, dirOf, recorderConfig } from './recorder.ts'

// A registered decision as a learnable one: the label string an eval case holds
// is the decision's own reading of the answers (its sample input stands in for the call's).
const learnable = <I, A>({ def }: { readonly def: DecisionDef<I, A> }): Learnable<I> => ({
  name: def.name,
  payload: def.payload,
  read: (answers) => {
    const v = def.read(answers, def.bar, def.sample())
    return v === undefined ? undefined : String(v)
  },
})

// The decisions `learn` can test.
const LEARNABLE: ReadonlyArray<Learnable<never>> = [
  learnable(decisions.link),
  learnable(decisions.change),
]

export const learn = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const cfg = yield* recorderConfig
  const path =
    cfg.path._tag === 'Some' ? cfg.path.value : `${dirOf(cfg.lessonsPath)}/jev-calls.jsonl`
  const rows = yield* readRows<CallRow>(fs, path)
  yield* Console.log(JSON.stringify({ log: path, decisions: summarize(rows) }, null, 2))
  const jev = yield* Jev
  const book = { ...(yield* readLessons(fs, cfg.lessonsPath)) }
  for (const d of LEARNABLE) {
    const cases = yield* readRows<EvalCase>(fs, evalsPath(cfg.evalsDir, d.name))
    const kept = yield* learnDecision(jev.ask, d, cases, book[d.name] ?? [])
    book[d.name] = kept
    yield* Console.log(`${d.name}: ${cases.length} cases, ${kept.length} lessons kept`)
  }
  yield* fs.makeDirectory(dirOf(cfg.lessonsPath), { recursive: true }).pipe(Effect.ignore)
  yield* writeLessons(fs, cfg.lessonsPath, book)
})

export const correctCall = (id: string, label: string, inputFile?: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const cfg = yield* recorderConfig
    const path =
      cfg.path._tag === 'Some' ? cfg.path.value : `${dirOf(cfg.lessonsPath)}/jev-calls.jsonl`
    const rows = [
      ...(yield* readRows<CallRow>(fs, path)),
      ...(yield* readRows<CallRow>(fs, `${path}.1`)),
    ]
    const input = inputFile === undefined ? undefined : (yield* readRows<unknown>(fs, inputFile))[0]
    const out = yield* correct(fs, rows, cfg.evalsDir, { id, label, input })
    yield* Console.log(`recorded the correction for ${out.decision} in ${out.path}`)
  })
