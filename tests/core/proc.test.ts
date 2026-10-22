// Subprocess-runner contract: concurrent pipe draining (no 64KB deadlock),
// mandatory timeout, exit-code capture — against real child processes. Each
// child is the running Bun itself: a `bun` on PATH may be a slow version-manager shim.
import { describe, expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { MAX_OUTPUT_BYTES, runProc } from '../../src/core/proc.ts'
import { eff } from '../_support/run.ts'

describe('runProc — spawn with drain + timeout', () => {
  test(
    'captures stdout, stderr and exit code',
    eff(
      Effect.gen(function* () {
        const { code, stdout, stderr, timedOut } = yield* runProc(
          [process.execPath, '-e', 'console.log("hi"); console.error("there")'],
          { timeoutMs: 10_000 },
        )
        expect(code).toBe(0)
        expect(stdout.trim()).toBe('hi')
        expect(stderr.trim()).toBe('there')
        expect(timedOut).toBe(false)
      }),
    ),
  )

  test(
    'env replaces the inherited environment',
    eff(
      Effect.gen(function* () {
        const script = 'console.log(process.env.ONLY, process.env.HOME)'
        const { stdout } = yield* runProc([process.execPath, '-e', script], {
          timeoutMs: 10_000,
          env: { ONLY: 'yes' },
        })
        expect(stdout.trim()).toBe('yes undefined')
      }),
    ),
  )

  test(
    'extendEnv merges env over the inherited environment',
    eff(
      Effect.gen(function* () {
        const script = 'console.log(process.env.ADDED, typeof process.env.PATH)'
        const { stdout } = yield* runProc([process.execPath, '-e', script], {
          timeoutMs: 10_000,
          env: { ADDED: 'yes' },
          extendEnv: true,
        })
        expect(stdout.trim()).toBe('yes string')
      }),
    ),
  )

  test(
    'drains >64KB of stderr without deadlocking',
    eff(
      Effect.gen(function* () {
        const script = 'process.stderr.write("e".repeat(128 * 1024)); console.log("done")'
        const { code, stdout, stderr } = yield* runProc([process.execPath, '-e', script], {
          timeoutMs: 10_000,
        })
        expect(code).toBe(0)
        expect(stdout.trim()).toBe('done')
        expect(stderr.length).toBe(128 * 1024)
      }),
    ),
    15_000,
  )

  test(
    'kills the child at the timeout and reports timedOut',
    eff(
      Effect.gen(function* () {
        const started = yield* Clock.currentTimeNanos
        const result = yield* runProc([process.execPath, '-e', 'await Bun.sleep(60000)'], {
          timeoutMs: 500,
        })
        const elapsedMs = Number((yield* Clock.currentTimeNanos) - started) / 1e6
        expect(elapsedMs).toBeLessThan(10_000)
        expect(result.timedOut).toBe(true)
        expect(result.code).not.toBe(0)
      }),
    ),
    15_000,
  )

  test(
    'a child killed by a non-timeout signal is NOT reported as timedOut',
    eff(
      Effect.gen(function* () {
        const result = yield* runProc(
          [process.execPath, '-e', 'process.kill(process.pid, "SIGKILL")'],
          {
            timeoutMs: 10_000,
          },
        )
        expect(result.timedOut).toBe(false)
        expect(result.code).not.toBe(0)
      }),
    ),
  )

  test(
    'reports a nonzero exit code',
    eff(
      Effect.gen(function* () {
        const { code, timedOut } = yield* runProc([process.execPath, '-e', 'process.exit(3)'], {
          timeoutMs: 10_000,
        })
        expect(code).toBe(3)
        expect(timedOut).toBe(false)
      }),
    ),
  )

  test(
    'passes stdin when provided',
    eff(
      Effect.gen(function* () {
        const script = 'process.stdout.write(await new Response(Bun.stdin.stream()).text())'
        const { code, stdout } = yield* runProc([process.execPath, '-e', script], {
          timeoutMs: 10_000,
          stdin: 'echo-me',
        })
        expect(code).toBe(0)
        expect(stdout).toBe('echo-me')
      }),
    ),
  )

  test(
    'caps child output and kills a child that keeps writing',
    eff(
      Effect.gen(function* () {
        const script = `process.stdout.write("x".repeat(${MAX_OUTPUT_BYTES} + 1024 * 1024)); await Bun.sleep(60000)`
        const result = yield* runProc([process.execPath, '-e', script], { timeoutMs: 30_000 })
        expect(result.truncated).toBe(true)
        expect(result.timedOut).toBe(false)
        expect(result.stdout.length).toBe(MAX_OUTPUT_BYTES)
        expect(result.code).not.toBe(0)
      }),
    ),
    40_000,
  )

  test(
    'SIGKILLs a child that ignores SIGTERM at the timeout',
    eff(
      Effect.gen(function* () {
        const script = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'
        const started = yield* Clock.currentTimeNanos
        const result = yield* runProc([process.execPath, '-e', script], { timeoutMs: 500 })
        const elapsedMs = Number((yield* Clock.currentTimeNanos) - started) / 1e6
        expect(result.timedOut).toBe(true)
        expect(elapsedMs).toBeLessThan(20_000)
      }),
    ),
    30_000,
  )
})
