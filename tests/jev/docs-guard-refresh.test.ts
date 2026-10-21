// Docs guard contracts, part two: the snapshot is refreshed with a conditional GET, kept
// on an outage, and refused when nothing verified exists.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { type GuardLog, refresh } from '../../src/lib/jev/docs-fetch.ts'
import { committedSnapshot, guarded } from '../../src/lib/jev/docs-guard.ts'
import type { DocsSnapshot, Headers } from '../../src/lib/jev/docs-snapshot.ts'
import { docs, jev, noul, req, runFs } from './docs-guard-support.ts'

type Reply = { status: number; text: string; lastModified?: string }

const recorder = (replies: ReadonlyArray<Reply | 'down'>) => {
  const seen: Array<Headers> = []
  const logs: GuardLog[] = []
  const get = (_: string, cond: Headers) => {
    const r = replies[Math.min(seen.length, replies.length - 1)]
    seen.push(cond)
    return r === 'down' || r === undefined ? Effect.fail('ECONNREFUSED') : Effect.succeed(r)
  }
  return { get, seen, logs, log: (l: GuardLog) => Effect.sync(() => void logs.push(l)) }
}

test('stale docs: a changed doc is re-proven and replaces the snapshot', () =>
  runFs(
    Effect.gen(function* () {
      const text = yield* docs
      const r = recorder([{ status: 200, text: `${text}A new line.\n`, lastModified: 'later' }])
      const snap = yield* refresh(jev, committedSnapshot, r.get, r.log)
      expect(snap.sha256).not.toBe(committedSnapshot.sha256)
      expect(snap.lines).toBe(committedSnapshot.lines + 1)
      expect(r.seen[0]).toEqual({
        etag: committedSnapshot.etag,
        lastModified: committedSnapshot.lastModified,
      })
      expect(r.logs.map((l) => l.event)).toEqual(['refreshed'])
    }),
  ))

test('unreachable docs: the last verified snapshot is used and logged; none verified refuses', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const r = recorder(['down'])
      expect(yield* refresh(jev, committedSnapshot, r.get, r.log)).toBe(committedSnapshot)
      expect(r.logs[0]?.event).toBe('stale-used')
      const none = recorder(['down'])
      const state: { snapshot: DocsSnapshot | undefined } = { snapshot: undefined }
      let called = false
      const err = yield* Effect.flip(
        guarded(
          JSON.stringify(req(noul)),
          state,
          none.get,
          none.log,
          Effect.sync(() => (called = true)),
        ),
      )
      expect(err._tag).toBe('DocsRefused')
      expect(called).toBe(false)
      expect(none.logs[0]?.event).toBe('refused')
    }),
  ))

test('O(1) per batch when docs are unchanged: one 304, no download, no re-proof', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const r = recorder([{ status: 304, text: '' }])
      const state: { snapshot: DocsSnapshot | undefined } = { snapshot: committedSnapshot }
      const body = JSON.stringify(req(noul))
      let calls = 0
      yield* Effect.forEach(
        Array.from({ length: 1000 }),
        () =>
          guarded(
            body,
            state,
            r.get,
            r.log,
            Effect.sync(() => calls++),
          ),
        { concurrency: 1, discard: true },
      )
      expect(calls).toBe(1000)
      expect(r.seen.length).toBe(1000) // one conditional GET per batch
      expect(state.snapshot).toBe(committedSnapshot) // same object: never re-hashed or re-parsed
      expect(r.logs.every((l) => l.event === 'unchanged')).toBe(true)
    }),
  ))
