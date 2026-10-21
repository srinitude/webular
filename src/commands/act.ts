// ACT command entry — invoked by `mise run run:act`. Parses flags, runs the
// Mastra act workflow (agent-browser), emits the result. No mise logic here.
// With --goal it instead plans the goal and runs it on the Cua window named
// by WEBULAR_CUA_WINDOW, emitting {status, at?, rungs}.
import { Effect, Random } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { emit } from '../core/output.ts'
import { requireSafeActWindow } from '../lib/cua-act-guard.ts'
import { planGoal } from '../lib/cua-goal.ts'
import { runGoal } from '../lib/cua-ground.ts'
import { decisionsFromEnv } from '../lib/cua-jev.ts'
import { cuaCall, cuaTarget, windowSetting } from '../lib/driver-cua.ts'

const bad = (message: string) => new CliError({ message, exitCode: EXIT.usage })

const actGoal = Effect.fnUntraced(function* (goal: string) {
  const target = cuaTarget(yield* windowSetting)
  if (!target)
    return yield* bad('act --goal: set WEBULAR_CUA_WINDOW=<pid>:<window_id> to the Cua window')
  const intents = planGoal(goal)
  if (intents.length === 0)
    return yield* bad('act --goal: name what to click, such as: click "Save" until it says "Saved"')
  // One session label for the whole run: element tokens and captures live
  // only inside the session that took the snapshot. start_session opens it
  // (the path the live native check proves) and end_session always closes
  // it, so no session stays open in the cua-driver daemon.
  const session = `webular-goal-${yield* Random.nextInt}`
  const call = (tool: string, args: Record<string, unknown>) => cuaCall(tool, { ...args, session })
  const decisions = yield* decisionsFromEnv
  return yield* Effect.mapError(
    Effect.andThen(
      // Refuse a browser window on a non-throwaway profile before any session opens.
      requireSafeActWindow(target.pid),
      Effect.acquireUseRelease(
        cuaCall('start_session', { session }),
        () => runGoal(call, target, goal, intents, decisions),
        () => Effect.ignore(cuaCall('end_session', { session })),
      ),
    ),
    (err) => new CliError({ message: `act --goal: ${err.message}`, exitCode: EXIT.failure }),
  )
})

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    screenshot: { type: 'string' },
    goal: { type: 'string' },
  })
  const goal = values['goal'] as string | undefined
  if (goal) {
    const out = yield* actGoal(goal)
    yield* emit(out, { ...emitOpts(values), json: true })
    return out.status === 'done' ? 0 : 1
  }
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    return yield* bad(
      'act: missing <url>. Pass --url <url> or put the URL after the command, or pass --goal "<plain goal>".',
    )
  }
  const inputData = { url, screenshot: values['screenshot'] as string | undefined }
  return yield* runWorkflow(
    'act',
    () => import('../workflows/act.ts'),
    (m) => m.actWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
