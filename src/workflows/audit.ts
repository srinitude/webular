// AUDIT workflow: detect deepsec availability, compose a scan plan.
// Non-model Mastra workflow over FOSS tools (deepsec via npx).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

export const auditInput = z.object({
  plan: z.boolean().optional(),
})

export const auditOutput = z.object({
  tool: z.literal('deepsec'),
  available: z.boolean(),
  command: z.string(),
})

async function checkDeepsecAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['npx', '--yes', 'deepsec', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    return code === 0
  } catch {
    return false
  }
}

const detectStep = createStep({
  id: 'detect',
  inputSchema: auditInput,
  outputSchema: z.object({ plan: z.boolean(), available: z.boolean() }),
  execute: async ({ inputData }) => ({
    plan: inputData.plan ?? true,
    available: await checkDeepsecAvailable(),
  }),
})

const planStep = createStep({
  id: 'plan',
  inputSchema: z.object({ plan: z.boolean(), available: z.boolean() }),
  outputSchema: auditOutput,
  execute: async ({ inputData }) => ({
    tool: 'deepsec' as const,
    available: inputData.available,
    command: 'npx deepsec init && cd .deepsec && deepsec scan',
  }),
})

export const auditWorkflow = createWorkflow({
  id: 'audit',
  inputSchema: auditInput,
  outputSchema: auditOutput,
})
  .then(detectStep)
  .then(planStep)
  .commit()
