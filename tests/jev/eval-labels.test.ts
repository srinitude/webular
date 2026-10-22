// Every Jev decision has an eval file, every eval file belongs to a decision, and every
// choice label in a case is an option the decision's payload offers for that case input.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { decideCropBox } from '../../src/lib/jev/decisions/crop-box.ts'
import { imageKindDecision } from '../../src/lib/jev/decisions/image-kind.ts'
import { routeDecision } from '../../src/lib/jev/decisions/image-router.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { fetchBlockDecision, fetchErrorDecision } from '../../src/lib/jev/fetch.ts'
import { fetchBrowserDecision } from '../../src/lib/jev/fetch-browser.ts'
import { nextEvent } from '../../src/lib/jev/machine.ts'

const root = `${import.meta.dir}/../..`
type Q = { type?: string; criteria?: Record<string, unknown> }
interface Def {
  readonly name: string
  readonly evals: string
  readonly payload: (i: never) => { questions: Record<string, Q> }
}
const all: ReadonlyArray<{ def: Def }> = [
  ...(Object.values(decisions) as unknown as Array<{ def?: Def }>).filter(
    (d): d is { def: Def } => typeof d.def?.evals === 'string',
  ),
  fetchErrorDecision,
  fetchBlockDecision,
  fetchBrowserDecision,
  nextEvent,
  routeDecision,
  decideCropBox,
  imageKindDecision,
] as never
// Eval files that grade a non-decision (a figure reader, a segmenter bench).
const NOT_DECISIONS = new Set(['answer.figure.json', 'research.sentences.segmenter.json'])
// Decisions whose label is not a menu key: the label is derived from the pick.
const DERIVED: Record<
  string,
  (
    label: string,
    input: { readonly candidates: ReadonlyArray<{ readonly text: string }> },
  ) => boolean
> = {
  // The agreed element's text, or '' for none.
  'extract.field': (l, i) => l === '' || i.candidates.some((c) => c.text === l),
  'extract.recover': (l, i) => l === '' || i.candidates.some((c) => c.text === l),
  // 'unsure' is the fallback verdict: no option, the picks stay.
  'summarize.core': (l) => l === 'unsure',
  // A crop rect is shown as 'crop'; no crop is 'none'.
  'chart.crop-box': (l) => l === 'crop',
}
const Cases = Schema.fromJsonString(
  Schema.Struct({
    'baseline-wins': Schema.Array(Schema.Struct({ input: Schema.Unknown, label: Schema.Unknown })),
    'baseline-loses': Schema.Array(Schema.Struct({ input: Schema.Unknown, label: Schema.Unknown })),
  }),
)
const run = <A>(e: Effect.Effect<A, unknown, FileSystem.FileSystem>) =>
  Effect.runPromise(e.pipe(Effect.provide(BunServices.layer)))

test('every eval file belongs to a decision, and every decision has its file', () =>
  run(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = 'tests/jev/evals'
      const onDisk = (yield* fs.readDirectory(`${root}/${dir}`)).filter((f) => f.endsWith('.json'))
      const claimed = new Set(all.map((d) => d.def.evals.replace(`${dir}/`, '')))
      // Segmenter cases feed the research-sentences bench, not a decision of their own.
      const orphans = onDisk.filter((f) => !claimed.has(f) && !NOT_DECISIONS.has(f))
      expect(orphans).toEqual([])
      for (const f of claimed) expect([f, onDisk.includes(f)]).toEqual([f, true])
    }),
  ))

test('every choice label in an eval case is an option of that decision', () =>
  run(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const bad: string[] = []
      for (const { def } of all) {
        const e = Schema.decodeUnknownSync(Cases)(yield* fs.readFileString(`${root}/${def.evals}`))
        for (const [i, c] of [...e['baseline-wins'], ...e['baseline-loses']].entries()) {
          const choices = Object.values(def.payload(c.input as never).questions).filter(
            (q) => q.type === 'choice',
          )
          if (choices.length === 0) continue
          const options = new Set(choices.flatMap((q) => Object.keys(q.criteria ?? {})))
          const labels = Array.isArray(c.label) ? c.label : [c.label]
          for (const l of labels)
            if (
              typeof l === 'string' &&
              !options.has(l) &&
              !DERIVED[def.name]?.(l, c.input as never)
            )
              bad.push(`${def.name}#${i}: ${l}`)
        }
      }
      expect(bad).toEqual([])
    }),
  ))
