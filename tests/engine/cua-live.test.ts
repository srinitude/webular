// Live Cua checks on the host, background delivery only. They run on macOS
// with cua-driver installed and WEBULAR_TEST_LIVE=1, and skip cleanly
// elsewhere, so a plain test run never opens a window.
// - Native mode: a fresh Calculator instance (its own pid, never the user's)
//   is driven through accessibility tokens by act --goal's runGoal.
// - Browser mode: the WEBULAR_CUA_WINDOW window must belong to a throwaway
//   Chrome profile, and its accessibility tree is read.
import { describe, expect, test } from 'bun:test'
import { Config, Effect, Schedule, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { planGoal } from '../../src/lib/cua-goal.ts'
import { runGoal } from '../../src/lib/cua-ground.ts'
import { fieldsOf, snapshot } from '../../src/lib/cua-tree.ts'
import { cuaCall, cuaTarget, requireThrowaway, windowSetting } from '../../src/lib/driver-cua.ts'
import { eff } from '../_support/run.ts'

const optIn = Effect.runSync(
  Effect.orElseSucceed(
    Effect.gen(function* () {
      return yield* Config.withDefault(Config.String('WEBULAR_TEST_LIVE'), '')
    }),
    () => '',
  ),
)
const live = process.platform === 'darwin' && Bun.which('cua-driver') !== null && optIn === '1'
const window = cuaTarget(Effect.runSync(windowSetting))

const Launched = Schema.Struct({ pid: Schema.Number, self_activation_suppressed: Schema.Boolean })
const Windows = Schema.Struct({
  windows: Schema.Array(Schema.Struct({ window_id: Schema.Number })),
})

const windowIds = (pid: number) =>
  Effect.flatMap(
    Effect.flatMap(cuaCall('list_windows', { pid }), fieldsOf),
    Schema.decodeUnknownEffect(Windows),
  )

const firstWindow = (pid: number) =>
  Effect.retry(
    Effect.flatMap(windowIds(pid), ({ windows }) =>
      windows[0] ? Effect.succeed(windows[0].window_id) : Effect.fail('no window yet'),
    ),
    { schedule: Schedule.spaced('250 millis'), times: 20 },
  )

const launch = Effect.flatMap(
  Effect.flatMap(
    cuaCall('launch_app', {
      bundle_id: 'com.apple.calculator',
      creates_new_application_instance: true,
    }),
    fieldsOf,
  ),
  Schema.decodeUnknownEffect(Launched),
)

// kill_app refuses a pid launched by another cua-driver call, so the test
// ends its own fresh instance by pid.
const calculator = Effect.acquireRelease(launch, ({ pid }) =>
  Effect.ignore(runProc(['kill', String(pid)], { timeoutMs: 5_000 })),
)

const nativeRun = Effect.gen(function* () {
  const launched = yield* calculator
  // launch_app reports whether focus stayed with the app the user had in front.
  expect(launched.self_activation_suppressed).toBe(true)
  const target = { pid: launched.pid, window_id: yield* firstWindow(launched.pid) }
  const session = `webular-live-${launched.pid}`
  const call = (tool: string, args: Record<string, unknown>) => cuaCall(tool, { ...args, session })
  yield* cuaCall('start_session', { session })
  // Calculator's display is not in its accessibility tree, so the step checks
  // the token click lands and verifies; it cannot read the result "7".
  const goal = 'click "7"'
  const out = yield* Effect.ensuring(
    runGoal(call, target, goal, planGoal(goal)),
    Effect.ignore(cuaCall('end_session', { session })),
  )
  expect(out).toEqual({ status: 'done', rungs: ['ax'] })
})

const browserRun = Effect.gen(function* () {
  const target = window ?? { pid: 0, window_id: 0 }
  yield* requireThrowaway(target.pid)
  const { elements } = yield* snapshot(cuaCall, target, false)
  expect(elements.length).toBeGreaterThan(0)
})

describe('Cua live, background only', () => {
  test.skipIf(!live)('native mode: act --goal drives Calculator by tokens', eff(nativeRun), 60_000)
  test.skipIf(!live || window === undefined)(
    'browser mode: the named window is a throwaway profile and its tree reads',
    eff(browserRun),
    60_000,
  )
})
