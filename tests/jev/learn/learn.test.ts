// Learning loop contract: the recorder writes one row per Jev call with no
// state text, rotates at its cap, and turns off by flag; a lesson is kept only
// when held-out accuracy holds and confidence rises; a correction becomes an
// eval case. The payload lint tests live in lint.test.ts.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, FileSystem } from 'effect'
import type { JevRequest, JevResult } from '../../../src/lib/jev/client.ts'
import { JevError } from '../../../src/lib/jev/errors.ts'
import {
  correct,
  type Learnable,
  learnDecision,
  parseRows,
  summarize,
} from '../../../src/lib/jev/learn/lessons.ts'
import { lintPayload } from '../../../src/lib/jev/learn/lint.ts'
import { type CallRow, withRecorder } from '../../../src/lib/jev/learn/recorder.ts'

const SECRET_PAGE = 'secret page text that must never reach the log'
const req: JevRequest = {
  state: { page: { text: SECRET_PAGE } },
  questions: {
    kind: {
      type: 'choice',
      instructions: 'What kind of page is `page`?',
      criteria: { docs: null, blog: 'a dated post' },
    },
  },
}
const answer: JevResult = {
  answers: { kind: { type: 'choice', choice: 'docs', confidence: 0.9 } },
  inputTokens: 42,
  model: 'jev-1.13.0',
  source: 'jev',
}

const inTemp = <A, E>(
  env: Record<string, string>,
  body: (dir: string) => Effect.Effect<A, E, FileSystem.FileSystem>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* fs.makeTempDirectoryScoped()
    const provider = ConfigProvider.fromEnvRecord({ WEBULAR_STATE_DIR: dir, ...env })
    return yield* body(dir).pipe(Effect.provide(ConfigProvider.layer(provider)))
  }).pipe(Effect.scoped, Effect.provide(BunServices.layer), Effect.runPromise)

const svc = (res: JevResult | 'fail') => ({
  available: true,
  ask: (_d: string, _r: JevRequest) =>
    res === 'fail'
      ? Effect.fail(new JevError({ reason: 'timeout', kind: 'timeout' }))
      : Effect.succeed(res),
})

test('recorder: one row per call, with hash, kinds, pick, confidence, and no state text', () =>
  inTemp({}, (dir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const jev = yield* withRecorder(svc(answer), {})
      yield* jev.ask('page.kind', req)
      yield* jev.ask('page.kind', req).pipe(Effect.ignore)
      const failing = yield* withRecorder(svc('fail'), {})
      yield* failing.ask('page.kind', req).pipe(Effect.ignore)
      const text = yield* fs.readFileString(`${dir}/jev-calls.jsonl`)
      expect(text).not.toContain(SECRET_PAGE)
      const rows = parseRows<CallRow>(text)
      expect(rows.length).toBe(3)
      expect(rows[0]).toMatchObject({
        decision: 'page.kind',
        model: 'jev-1.13.0',
        questionKinds: { kind: 'choice' },
        pick: { kind: 'docs' },
        confidence: 0.9,
        inputTokens: 42,
        fallback: false,
        codeCheck: null,
      })
      expect(rows[2]).toMatchObject({ fallback: true, model: null, pick: {} })
      expect(summarize(rows)['page.kind']?.calls).toBe(3)
    }),
  ))

test('recorder: rotates at the byte cap and keeps the set number of files', () =>
  inTemp({ WEBULAR_JEV_CALLS_MAX_BYTES: '10', WEBULAR_JEV_CALLS_FILES: '2' }, (dir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const jev = yield* withRecorder(svc(answer), {})
      for (let i = 0; i < 5; i++) yield* jev.ask('page.kind', req)
      expect(yield* fs.exists(`${dir}/jev-calls.jsonl.1`)).toBe(true)
      expect(yield* fs.exists(`${dir}/jev-calls.jsonl.2`)).toBe(true)
      expect(yield* fs.exists(`${dir}/jev-calls.jsonl.3`)).toBe(false)
    }),
  ))

test('recorder: WEBULAR_JEV_CALLS=off writes nothing', () =>
  inTemp({ WEBULAR_JEV_CALLS: 'off' }, (dir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const jev = yield* withRecorder(svc(answer), {})
      yield* jev.ask('page.kind', req)
      expect(yield* fs.exists(`${dir}/jev-calls.jsonl`)).toBe(false)
    }),
  ))

test('recorder: kept lessons reshape the payload at once', () =>
  inTemp({}, () =>
    Effect.gen(function* () {
      let seen: JevRequest | undefined
      const spy = {
        available: true,
        ask: (_d: string, r: JevRequest) =>
          Effect.sync(() => {
            seen = r
            return answer
          }),
      }
      const s = { accuracy: 1, confidence: 1, cases: 1 }
      const jev = yield* withRecorder(spy, {
        'page.kind': [{ kind: 'structured-options', before: s, after: s }],
      })
      yield* jev.ask('page.kind', req)
      expect(
        lintPayload(seen as JevRequest).filter((f) => f.rule === 'structured-options'),
      ).toEqual([])
    }),
  ))

// A fake Jev that is right and sure only when options are structured.
const learnable: Learnable<{ kind: string }> = {
  name: 'page.kind',
  payload: () => req,
  read: (a) => a['kind']?.choice,
}
const fakeAsk = (truth: string) => (_d: string, r: JevRequest) => {
  const structuredOpts = lintPayload(r).every((f) => f.rule !== 'structured-options')
  return Effect.succeed<JevResult>({
    answers: {
      kind: {
        type: 'choice',
        choice: structuredOpts ? truth : 'blog',
        confidence: structuredOpts ? 0.97 : 0.6,
      },
    },
    inputTokens: 1,
  })
}
const cases = [0, 1, 2, 3, 4, 5].map(() => ({ input: { kind: 'docs' }, label: 'docs' }))

test('learn: keeps a lesson when held-out accuracy holds and confidence rises', () =>
  Effect.runPromise(
    learnDecision(fakeAsk('docs'), learnable, cases, []).pipe(
      Effect.tap((kept) => {
        expect(kept.map((l) => l.kind)).toEqual(['structured-options'])
        expect(kept[0]?.after.confidence).toBeGreaterThan(kept[0]?.before.confidence ?? 1)
        expect(kept[0]?.after.cases).toBe(2) // every third case is held out
        return Effect.void
      }),
    ),
  ))

test('learn: drops a lesson that raises confidence but loses accuracy', () =>
  Effect.runPromise(
    learnDecision(
      fakeAsk('docs'),
      learnable,
      cases.map((c) => ({ ...c, label: 'blog' })),
      [],
    ).pipe(Effect.map((kept) => expect(kept).toEqual([]))),
  ))

test('learn: cases with no input are skipped, so nothing is kept', () =>
  Effect.runPromise(
    learnDecision(fakeAsk('docs'), learnable, [{ label: 'docs' }], []).pipe(
      Effect.map((kept) => expect(kept).toEqual([])),
    ),
  ))

test('correct: a recorded call becomes a labeled eval case; an unknown id fails', () =>
  inTemp({}, (dir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const rows = [{ id: 'abc-1', decision: 'crawl.link', payloadHash: 'ff' }]
      const out = yield* correct(fs, rows, `${dir}/jev-evals`, {
        id: 'abc-1',
        label: 'true',
        input: { goal: 'g' },
      })
      expect(out.path).toBe(`${dir}/jev-evals/crawl.link.jsonl`)
      expect(parseRows(yield* fs.readFileString(out.path))).toEqual([
        { callId: 'abc-1', label: 'true', payloadHash: 'ff', input: { goal: 'g' } },
      ])
      const missing = yield* correct(fs, rows, dir, { id: 'nope', label: 'x' }).pipe(Effect.flip)
      expect(missing).toContain('no recorded Jev call nope')
    }),
  ))
