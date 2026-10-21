// TASKS contract — real mise invocation from repo root (no mocks).
import { describe, expect, test } from 'bun:test'

import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const runTasks = (args: string[]) => runCli('src/commands/tasks.ts', args)

const jsonCase = Effect.gen(function* () {
  const { code, out } = yield* runTasks(['--json'])
  expect(code).toBe(0)
  const data = JSON.parse(out)
  expect(typeof data.count).toBe('number')
  expect(data.count).toBeGreaterThan(0)
  expect(Array.isArray(data.tasks)).toBe(true)
  expect(data.tasks).toContain('run:scrape')
  expect(data.tasks).toContain('ci')
})

const plainCase = Effect.gen(function* () {
  const { code, out } = yield* runTasks([])
  expect(code).toBe(0)
  expect(out).toContain('run:scrape')
  expect(out).toContain('ci')
})

const noLeakCase = Effect.gen(function* () {
  const { code, out } = yield* runTasks(['--json'])
  expect(code).toBe(0)
  const data = JSON.parse(out) as { tasks: string[] }
  const toml = yield* io(() => Bun.file(`${ROOT}/mise.toml`).text())
  const own = (Bun.TOML.parse(toml) as { tasks: Record<string, unknown> }).tasks
  const foreign = data.tasks.filter((t) => !(t in own))
  expect(foreign).toEqual([])
})

describe('webular tasks — introspect the mise task graph (real mise)', () => {
  test('emits structured JSON with --json and includes expected tasks', eff(jsonCase), 30_000)
  test('prints task list in plain text without --json', eff(plainCase), 30_000)
  test(
    "lists only tasks from webular's own mise.toml (no foreign-config leak)",
    eff(noLeakCase),
    30_000,
  )
})
