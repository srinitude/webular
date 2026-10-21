// Real cua-driver replies captured from a throwaway Chrome window decode
// through the same readers the action ladder uses.
import { describe, expect, test } from 'bun:test'
import { Effect, Exit, Schema } from 'effect'
import { Regions, Verified, verified } from '../../src/lib/cua-ladder.ts'
import { fieldsOf } from '../../src/lib/cua-tree.ts'

const raw = (name: string) =>
  Effect.promise(() => Bun.file(`${import.meta.dir}/../fixtures/cua/${name}`).text())
const fixture = (name: string) => Effect.flatMap(raw(name), fieldsOf)

const target = { pid: 1, window_id: 2 }
const shows = (text: string) => ({ element: { selector: { label_contains: text }, exists: true } })

// Runs verified against a fake driver that answers verify_state with the
// given reply and get_window_state with the captured "Done" window, logging
// each tool it is asked for.
const verifyWith = (verifyReply: string, text: string) =>
  Effect.gen(function* () {
    const tree = yield* raw('get-window-state-done.json')
    const calls: string[] = []
    const call = (tool: string, _args: Record<string, unknown>) => {
      calls.push(tool)
      return Effect.succeed(tool === 'verify_state' ? verifyReply : tree)
    }
    return { ok: yield* verified(call, target, shows(text)), calls }
  })

describe('captured cua-driver replies', () => {
  test('verify_state on web content reads as unknown, never satisfied', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const v = yield* Schema.decodeUnknownEffect(Verified)(yield* fixture('verify-state.json'))
        expect(v.status).toBe('unknown')
      }),
    ))

  test('parse_visual_regions without the perception extension yields no regions', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const reply = yield* fixture('parse-visual-regions.json')
        expect(reply['code']).toBe('not_installed')
        const exit = yield* Effect.exit(Schema.decodeUnknownEffect(Regions)(reply))
        expect(Exit.isFailure(exit)).toBe(true)
      }),
    ))
})

describe('verified on untrusted web content', () => {
  const run = (text: string, want: unknown, edit = (reply: string) => reply) =>
    Effect.runPromise(
      Effect.map(
        Effect.flatMap(raw('verify-state.json'), (reply) => verifyWith(edit(reply), text)),
        (got) => expect(got).toEqual(want as typeof got),
      ),
    )

  test('one fresh window read that shows the text passes', () =>
    run('Done', { ok: true, calls: ['verify_state', 'get_window_state'] }))

  test('a window read without the text fails, with no retry', () =>
    run('Not on the page', { ok: false, calls: ['verify_state', 'get_window_state'] }))

  test('unknown for any other reason fails without reading the window', () =>
    run('Done', { ok: false, calls: ['verify_state'] }, (r) =>
      r.replace('untrusted_source', 'timeout'),
    ))
})
