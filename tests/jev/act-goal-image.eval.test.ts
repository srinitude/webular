// Eval: `act --goal` on a window whose element tree does not name the target
// (a canvas button). The code arm stops as infeasible; the page-image arm asks
// Jev for a Box on the window screenshot and clicks its center. Offline it
// replays recorded answers in both question orders; WEBULAR_TEST_LIVE=1 asks
// Jev for real.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Config, Console, Effect, FileSystem, Option } from 'effect'
import { planGoal } from '../../src/lib/cua-goal.ts'
import { codeDecisions, type Decisions, runGoal } from '../../src/lib/cua-ground.ts'
import { imageOk, locateByImage, type Shot } from '../../src/lib/cua-image-locate.ts'
import { postJev } from '../../src/lib/cua-jev.ts'
import type { Call } from '../../src/lib/cua-tree.ts'

const goal = 'click "the bar chart"'
const target = { pid: 1, window_id: 1 }
const loadShot = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const bytes = yield* fs.readFile('tests/jev/fixtures/bar-chart-320.png')
  const shot: Shot = { base64: bytes.toBase64(), format: 'png', width: 320, height: 320 }
  return shot
}).pipe(Effect.provide(BunServices.layer))

// A fake Cua window: no AX element names the target; the screenshot rides in content.
const windowCall =
  (base64: string, clicks: Array<Record<string, unknown>>): Call =>
  (tool, args) => {
    if (tool === 'click') clicks.push(args)
    return Effect.succeed(
      JSON.stringify({
        elements: [{ element_index: 0, role: 'AXGroup', label: 'canvas' }],
        capture_id: 'cap-1',
        screenshot_width: 320,
        screenshot_height: 320,
        content: [{ type: 'image', data: base64, mimeType: 'image/png' }],
        status: 'satisfied',
      }),
    )
  }

const EDGES = ['top', 'bottom', 'left', 'right']
// Recorded answers, with the edge questions in forward or reverse order.
const recorded = (edges: ReadonlyArray<string>) => () =>
  Effect.succeed({
    answers: {
      is_there: { noul: 0.99 },
      where: { box: { top: 0.1, bottom: 0.9, left: 0.1, right: 0.9 } },
      ...Object.fromEntries(edges.map((e) => [`cut_${e}`, { noul: 0.02 }])),
    },
  })

test('API image limits: 280 to 1568 px per side, PNG or JPEG', () => {
  const ok: Shot = { base64: 'AAAA', format: 'png', width: 320, height: 320 }
  expect(imageOk(ok)).toBe(true)
  expect(imageOk({ ...ok, width: 279 })).toBe(false)
  expect(imageOk({ ...ok, width: 1569 })).toBe(false)
})

const offline = Effect.gen(function* () {
  const shot = yield* loadShot
  const intents = planGoal(goal)
  const before = yield* runGoal(windowCall(shot.base64, []), target, goal, intents, codeDecisions)
  const rows: boolean[] = []
  for (const edges of [EDGES, [...EDGES].reverse()]) {
    const clicks: Array<Record<string, unknown>> = []
    const decisions: Decisions = {
      ...codeDecisions,
      locate: (g, i, s) => locateByImage(recorded(edges), g, i, s),
    }
    const after = yield* runGoal(windowCall(shot.base64, clicks), target, goal, intents, decisions)
    rows.push(after.status === 'done' && clicks.some((c) => c['x'] === 160 && c['y'] === 160))
  }
  const after = rows.filter(Boolean).length / rows.length
  const beforeRate = before.status === 'done' ? 1 : 0
  yield* Console.log(
    JSON.stringify({ eval: 'act.goal.image', cases: 2, before: beforeRate, after }),
  )
  expect(before.status).toBe('infeasible')
  expect(after).toBe(1)
})

test('offline: code arm is infeasible, image arm clicks the box center', () =>
  Effect.runPromise(offline))

const liveRun = Effect.gen(function* () {
  const shot = yield* loadShot
  const intent = { label: 'the bar chart', expect: {} }
  const point = yield* locateByImage(postJev, goal, intent, shot)
  yield* Console.log(
    JSON.stringify({ eval: 'act.goal.image.live', point: Option.getOrNull(point) }),
  )
  expect(Option.isSome(point)).toBe(true)
})

const live = Effect.runSync(Config.Boolean('WEBULAR_TEST_LIVE').pipe(Config.withDefault(false)))
test.skipIf(!live)(
  'live: Jev boxes the bar chart inside the window',
  () => Effect.runPromise(liveRun),
  30_000,
)
