// AUDIT workflow: report deepsec availability + the scan plan. Keyless by
// design — deepsec scans need LLM API keys, so webular only detects and
// plans. The bin resolves locally (PATH or the packaged devDependency);
// never `npx --yes`, which would network-install at runtime.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'

const auditInput = z.object({})

const auditOutput = z.object({
  tool: z.literal('deepsec'),
  available: z.boolean(),
  command: z.string(),
  hint: z.string().optional(),
})

async function detectDeepsec(): Promise<boolean> {
  const bin = resolveBin('deepsec')
  if (!bin) return false
  const { code } = await runProc([bin, '--version'], { timeoutMs: 10_000 })
  return code === 0
}

const detectStep = createStep({
  id: 'detect',
  inputSchema: auditInput,
  outputSchema: auditOutput,
  execute: async () => {
    const available = await detectDeepsec()
    return {
      tool: 'deepsec' as const,
      available,
      command: 'deepsec init && cd .deepsec && deepsec scan',
      ...(available ? {} : { hint: "dev tool — run 'bun add -d deepsec' in a checkout to enable" }),
    }
  },
})

export const auditWorkflow = createWorkflow({
  id: 'audit',
  inputSchema: auditInput,
  outputSchema: auditOutput,
})
  .then(detectStep)
  .commit()
