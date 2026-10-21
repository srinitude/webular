// Contract for the situation rules of the repo-level jev-docs-gate hook: one docs receipt
// per situation, a JEV-SITUATION line on an agent's first action that binds its later
// actions, and the refusal codes situation_missing and borrowed_fetch.

import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import {
  type Copy,
  declaredSituation,
  gate,
  type Receipt,
  receiptRefusal,
  situationOf,
  type Who,
} from '../../.claude/hooks/jev-docs-gate-rule.ts'

const SHA = 'a'.repeat(64)
const receipt: Receipt = {
  session: 's1',
  decomposition: '/tmp/decomposition.json',
  decomposer: 'opus',
  pages_read: 274,
  url_count: 274,
  url_list_sha256: 'b'.repeat(64),
  llms_path: '/tmp/llms-full.txt',
  llms_bytes: 1047658,
  llms_sha256: SHA,
  llms_lines: 24598,
  fetched_at: '2026-10-21T05:47:00Z',
  lines_covered: 24598,
  situation: 'parse-fix',
  agent: 'main',
}
const copy: Copy = { bytes: 1047658, sha256: SHA, lines: 24598 }
const who: Who = { situation: 'parse-fix', agent: 'main' }
const refuse = (r: Partial<Receipt>, w: Who = who) =>
  receiptRefusal({ ...receipt, ...r }, 's1', SHA, true, copy, w)
const jev = '/repo/src/lib/jev/client.ts'

test('rule 1: a receipt passes only for the situation it is keyed by', () => {
  expect(refuse({})).toBeUndefined()
  expect(refuse({}, { ...who, situation: 'other' })).toBe('borrowed_fetch')
  expect(refuse({ situation: undefined })).toBe('borrowed_fetch')
})

test('rule 2: the first JEV-SITUATION line names the situation and later actions stay bound', () => {
  expect(declaredSituation('x\nJEV-SITUATION: parse-fix\ny')).toBe('parse-fix')
  expect(declaredSituation('const a = 1 // JEV-SITUATION: nope')).toBeUndefined()
  expect(declaredSituation('JEV-SITUATION: bad name')).toBeUndefined()
  expect(situationOf('parse-fix', undefined)).toBe('parse-fix')
  expect(situationOf(undefined, 'parse-fix')).toBe('parse-fix')
  expect(situationOf('other', 'parse-fix')).toBe('parse-fix')
  expect(situationOf(undefined, undefined)).toBeUndefined()
})

test('rule 3: borrowed_fetch is a receipt from another agent, and it never passes the gate', () => {
  expect(refuse({ agent: 'helper-1' })).toBe('borrowed_fetch')
  expect(refuse({ agent: undefined })).toBeUndefined()
  expect(gate(jev, undefined, SHA, 0, false, 'borrowed_fetch')).toContain('borrowed_fetch')
  expect(gate(jev, undefined, SHA, 0, false, true)).toBeUndefined()
  expect(gate('src/core/cache.ts', undefined, SHA, 0, false, 'borrowed_fetch')).toBeUndefined()
})

// The hook end to end in a temp HOME: situation_missing without a line, then a bound
// situation that later actions keep with no line.
const file_path = '/repo/src/lib/jev/client.ts'
const hook = (home: string, tool: Record<string, string>, agent = 'a1') =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const stdin = Stream.make(
      new TextEncoder().encode(
        JSON.stringify({ session_id: 's1', agent_id: agent, tool_input: tool }),
      ),
    )
    return yield* spawner.string(
      ChildProcess.make('bun', [`${import.meta.dir}/../../.claude/hooks/jev-docs-gate.ts`], {
        env: { HOME: home, WEBULAR_JEV_DOCS_GATE: '' },
        extendEnv: true,
        stdin,
      }),
    )
  })
const Binding = Schema.fromJsonString(Schema.Struct({ situation: Schema.String }))

test(
  'hook: a first Jev action with no line is situation_missing, and a line binds the agent',
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const home = yield* fs.makeTempDirectoryScoped({ prefix: 'jev-situation-' })
          expect(yield* hook(home, { file_path })).toContain('situation_missing')
          const first = yield* hook(home, { file_path, new_string: 'JEV-SITUATION: parse-fix' })
          expect(first).not.toContain('situation_missing')
          const bound = yield* fs.readFileString(
            `${home}/.local/state/decision-models-first/bindings/s1/a1.json`,
          )
          expect(yield* Schema.decodeUnknownEffect(Binding)(bound)).toEqual({
            situation: 'parse-fix',
          })
          expect(yield* hook(home, { file_path })).not.toContain('situation_missing')
          expect(yield* hook(home, { file_path }, 'a2')).toContain('situation_missing')
        }),
      ).pipe(Effect.provide(BunServices.layer)),
    ),
  90_000,
) // five hook processes; bun startup alone can take seconds under load

test(
  'hook: after 3 denials an agent passes, and each pass leaves a violation row',
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const home = yield* fs.makeTempDirectoryScoped({ prefix: 'jev-denials-' })
          for (const _ of [1, 2, 3])
            expect(yield* hook(home, { file_path }, 'a3')).toContain('deny')
          expect(yield* hook(home, { file_path }, 'a3')).toBe('')
          const rows = yield* fs.readFileString(
            `${home}/.local/state/webular-jev-docs-gate/violations.jsonl`,
          )
          expect(rows.trim().split('\n')).toHaveLength(1)
          expect(rows).toContain('"agent":"a3"')
          expect(yield* hook(home, { file_path }, 'a4')).toContain('deny')
        }),
      ).pipe(Effect.provide(BunServices.layer)),
    ),
  90_000,
) // five hook processes, as above
