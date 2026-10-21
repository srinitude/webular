// TASKS workflow: introspect webular's OWN task graph. `mise tasks ls --json`
// carries each task's source config; filtering on our mise.toml keeps user
// and parent configs from leaking into the report.

import { join } from 'node:path'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect, FileSystem } from 'effect'
import { z } from 'zod'
import { EXIT } from '../cli/exit-codes.ts'
import { CliError } from '../core/effect.ts'
import { errMsg } from '../core/output.ts'
import { runProc } from '../core/proc.ts'
import { PACKAGE_ROOT } from '../core/root.ts'
import { resolveMise } from '../mise/gateway.ts'
import { stepRuntime } from './runtime.ts'

const fail = (message: string) => new CliError({ message, exitCode: EXIT.failure })

// Symlinked installs (bun link, pnpm stores) make mise's reported source path
// and our import.meta-derived root spell the same file differently.
const canonical = (p: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.realPath(p)).pipe(Effect.orElseSucceed(() => p))

const tasksInput = z.object({})

const tasksOutput = z.object({
  count: z.number(),
  tasks: z.array(z.string()),
})

type TaskRow = { name?: string; source?: string }

const listTasks = Effect.fn('tasks.list')(function* () {
  const mise = yield* resolveMise()
  if (!mise) return yield* fail('mise not found (PATH or bundled)')
  const { code, stdout, stderr, timedOut } = yield* runProc([mise, 'tasks', 'ls', '--json'], {
    timeoutMs: 10_000,
    cwd: PACKAGE_ROOT,
  })
  if (code !== 0)
    return yield* fail(`mise tasks ls failed (${timedOut ? 'timeout' : stderr.trim() || code})`)
  const own = yield* canonical(join(PACKAGE_ROOT, 'mise.toml'))
  const parsed = yield* Effect.try({
    try: () => JSON.parse(stdout) as TaskRow[],
    catch: (err) => fail(errMsg(err)),
  })
  const owned = yield* Effect.filter(parsed, (t) =>
    t.source === undefined
      ? Effect.succeed(false)
      : Effect.map(canonical(t.source), (s) => s === own),
  )
  const tasks = owned.map((t) => t.name ?? '').filter((name) => name.length > 0)
  return { count: tasks.length, tasks }
})

const listStep = createStep({
  id: 'list',
  inputSchema: tasksInput,
  outputSchema: tasksOutput,
  execute: () => stepRuntime.runPromise(listTasks()),
})

export const tasksWorkflow = createWorkflow({
  id: 'tasks',
  inputSchema: tasksInput,
  outputSchema: tasksOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(listStep)
  .commit()
