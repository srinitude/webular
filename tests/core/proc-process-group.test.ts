// A timeout must stop the child's whole process tree, not only the child: a
// grandchild left running is an orphan that outlives the command that started it.
import { describe, expect, test } from 'bun:test'
import { Effect, Fiber, FileSystem, Schedule } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { eff, tmpDir } from '../_support/run.ts'

const alive = (pid: number) =>
  Effect.try(() => process.kill(pid, 0)).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  )

// A runtime script, not /bin/sh, so it runs on Windows too: the child starts a
// grandchild, writes its pid, and both wait far past the timeout.
const parentScript = (pidFile: string) =>
  [
    "const g = require('node:child_process').spawn(process.execPath,",
    "['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });",
    `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(g.pid));`,
    'setTimeout(() => {}, 30000);',
  ].join(' ')

// Poll with a deadline: the group signal lands at once, the exit a moment later.
const survives = (pid: number) =>
  pid <= 0
    ? Effect.succeed(true)
    : alive(pid).pipe(
        Effect.repeat({
          until: (up) => !up,
          schedule: Schedule.spaced('20 millis').pipe(Schedule.upTo({ times: 150 })),
        }),
        Effect.timeoutOption('2 seconds'),
        Effect.map((done) => done._tag === 'None'),
        Effect.tap((up) =>
          up ? Effect.try(() => process.kill(pid, 'SIGKILL')).pipe(Effect.ignore) : Effect.void,
        ),
      )

describe('runProc — timeout kills the process group', () => {
  test(
    'a grandchild started by the child dies with it on timeout',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const dir = yield* tmpDir('proc-group-')
        const pidFile = `${dir}/grandchild.pid`
        const { timedOut } = yield* runProc([process.execPath, '-e', parentScript(pidFile)], {
          timeoutMs: 2000,
        })
        expect(timedOut).toBe(true)
        expect(yield* survives(Number((yield* fs.readFileString(pidFile)).trim()))).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'cancelling the command kills the grandchild too',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const pidFile = `${yield* tmpDir('proc-cancel-')}/grandchild.pid`
        const run = runProc([process.execPath, '-e', parentScript(pidFile)], { timeoutMs: 30_000 })
        const fiber = yield* Effect.forkChild(run)
        // Wait for a whole pid: pid 0 would mean our own process group.
        const pid = yield* fs.readFileString(pidFile).pipe(
          Effect.map((text) => Number(text.trim())),
          Effect.filterOrFail((n) => n > 0),
          Effect.retry({
            schedule: Schedule.spaced('20 millis').pipe(Schedule.upTo({ times: 250 })),
          }),
        )
        yield* Fiber.interrupt(fiber)
        expect(yield* survives(pid)).toBe(false)
      }),
    ),
    15_000,
  )
})
