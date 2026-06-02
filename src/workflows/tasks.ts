// TASKS workflow: spawn mise tasks ls → parse task names.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

export const tasksInput = z.object({
  cwd: z.string().optional(),
})

export const tasksOutput = z.object({
  count: z.number(),
  tasks: z.array(z.string()),
})

const listStep = createStep({
  id: 'list',
  inputSchema: tasksInput,
  outputSchema: tasksOutput,
  execute: async ({ inputData }) => {
    const proc = Bun.spawn(['mise', 'tasks', 'ls'], {
      cwd: inputData.cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const raw = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) throw new Error(`mise tasks ls failed (exit ${code})`)
    const tasks = raw
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((name): name is string => name != null && name.length > 0)
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
