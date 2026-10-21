// AUDIT workflow: report deepsec availability + the scan plan. Keyless by
// design — deepsec scans need LLM API keys, so webular only detects and
// plans. The bin resolves locally (PATH or the packaged devDependency);
// never `npx --yes`, which would network-install at runtime.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { resolveBin } from '../core/root.ts'
import { stepRuntime } from './runtime.ts'

const auditInput = z.object({})

const auditOutput = z.object({
  tool: z.literal('deepsec'),
  available: z.boolean(),
  command: z.string(),
  hint: z.string().optional(),
})

// An executable on PATH or in node_modules/.bin counts as available. No
// `deepsec --version` probe: its CLI loads its whole module graph at start
// (about 17 s wall, 1.3 s CPU on a loaded disk), which outran the probe's
// 10 s timeout and reported an installed deepsec as missing.
const detectDeepsec = Effect.map(resolveBin('deepsec'), (bin) => bin !== null)

const detectStep = createStep({
  id: 'detect',
  inputSchema: auditInput,
  outputSchema: auditOutput,
  execute: () =>
    stepRuntime.runPromise(
      Effect.map(detectDeepsec, (available) => ({
        tool: 'deepsec' as const,
        available,
        command: 'deepsec init && cd .deepsec && deepsec scan',
        ...(available
          ? {}
          : { hint: "dev tool — run 'bun add -d deepsec' in a checkout to enable" }),
      })),
    ),
})

export const auditWorkflow = createWorkflow({
  id: 'audit',
  inputSchema: auditInput,
  outputSchema: auditOutput,
})
  .then(detectStep)
  .commit()
