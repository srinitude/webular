// TASKS contract — real mise invocation from repo root (no mocks).
import { describe, expect, test } from 'bun:test'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

const runTasks = (args: string[]) => runCli('src/commands/tasks.ts', args)

describe('webular tasks — introspect the mise task graph (real mise)', () => {
  test('emits structured JSON with --json and includes expected tasks', async () => {
    const { code, out } = await runTasks(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.count).toBe('number')
    expect(data.count).toBeGreaterThan(0)
    expect(Array.isArray(data.tasks)).toBe(true)
    expect(data.tasks).toContain('run:scrape')
    expect(data.tasks).toContain('ci')
  }, 30_000)

  test('prints task list in plain text without --json', async () => {
    const { code, out } = await runTasks([])
    expect(code).toBe(0)
    expect(out).toContain('run:scrape')
    expect(out).toContain('ci')
  }, 30_000)

  test("lists only tasks from webular's own mise.toml (no foreign-config leak)", async () => {
    const { code, out } = await runTasks(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out) as { tasks: string[] }
    const foreign = data.tasks.filter((t) => t.includes(':') && !t.startsWith('run:'))
    expect(foreign).toEqual([])
  }, 30_000)
})
