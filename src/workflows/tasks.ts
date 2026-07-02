// TASKS workflow: introspect webular's OWN task graph. `mise tasks ls --json`
// carries each task's source config; filtering on our mise.toml keeps user
// and parent configs from leaking into the report.
import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { runProc } from '../core/proc.ts'
import { PACKAGE_ROOT } from '../core/root.ts'
import { resolveMise } from '../mise/gateway.ts'

// Symlinked installs (bun link, pnpm stores) make mise's reported source path
// and our import.meta-derived root spell the same file differently.
function canonical(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

const tasksInput = z.object({})

const tasksOutput = z.object({
  count: z.number(),
  tasks: z.array(z.string()),
})

const listStep = createStep({
  id: 'list',
  inputSchema: tasksInput,
  outputSchema: tasksOutput,
  execute: async () => {
    const mise = resolveMise()
    if (!mise) throw new Error('mise not found (PATH or bundled)')
    const { code, stdout, stderr, timedOut } = await runProc([mise, 'tasks', 'ls', '--json'], {
      timeoutMs: 10_000,
      cwd: PACKAGE_ROOT,
    })
    if (code !== 0)
      throw new Error(`mise tasks ls failed (${timedOut ? 'timeout' : stderr.trim() || code})`)
    const own = canonical(join(PACKAGE_ROOT, 'mise.toml'))
    const parsed = JSON.parse(stdout) as { name?: string; source?: string }[]
    const tasks = parsed
      .filter((t) => t.source !== undefined && canonical(t.source) === own)
      .map((t) => t.name ?? '')
      .filter((name) => name.length > 0)
    return { count: tasks.length, tasks }
  },
})

export const tasksWorkflow = createWorkflow({
  id: 'tasks',
  inputSchema: tasksInput,
  outputSchema: tasksOutput,
})
  .then(listStep)
  .commit()
