// Subprocess-runner contract: concurrent pipe draining (no 64KB deadlock),
// mandatory timeout, exit-code capture — against real child processes.
import { describe, expect, test } from 'bun:test'
import { runProc } from '../../src/core/proc.ts'

describe('runProc — spawn with drain + timeout', () => {
  test('captures stdout, stderr and exit code', async () => {
    const { code, stdout, stderr, timedOut } = await runProc(
      ['bun', '-e', 'console.log("hi"); console.error("there")'],
      { timeoutMs: 10_000 },
    )
    expect(code).toBe(0)
    expect(stdout.trim()).toBe('hi')
    expect(stderr.trim()).toBe('there')
    expect(timedOut).toBe(false)
  })

  test('drains >64KB of stderr without deadlocking', async () => {
    const script = 'process.stderr.write("e".repeat(128 * 1024)); console.log("done")'
    const { code, stdout, stderr } = await runProc(['bun', '-e', script], { timeoutMs: 10_000 })
    expect(code).toBe(0)
    expect(stdout.trim()).toBe('done')
    expect(stderr.length).toBe(128 * 1024)
  }, 15_000)

  test('kills the child at the timeout and reports timedOut', async () => {
    const started = Date.now()
    const result = await runProc(['bun', '-e', 'await Bun.sleep(60000)'], { timeoutMs: 500 })
    expect(Date.now() - started).toBeLessThan(10_000)
    expect(result.timedOut).toBe(true)
    expect(result.code).not.toBe(0)
  }, 15_000)

  test('a child killed by a non-timeout signal is NOT reported as timedOut', async () => {
    const result = await runProc(['bun', '-e', 'process.kill(process.pid, "SIGKILL")'], {
      timeoutMs: 10_000,
    })
    expect(result.timedOut).toBe(false)
    expect(result.code).not.toBe(0)
  })

  test('reports a nonzero exit code', async () => {
    const { code, timedOut } = await runProc(['bun', '-e', 'process.exit(3)'], {
      timeoutMs: 10_000,
    })
    expect(code).toBe(3)
    expect(timedOut).toBe(false)
  })

  test('passes stdin when provided', async () => {
    const script = 'process.stdout.write(await new Response(Bun.stdin.stream()).text())'
    const { code, stdout } = await runProc(['bun', '-e', script], {
      timeoutMs: 10_000,
      stdin: 'echo-me',
    })
    expect(code).toBe(0)
    expect(stdout).toBe('echo-me')
  })
})
