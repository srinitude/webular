// MEDIA workflow: download bytes (capped), or capture screenshot/PDF via
// agent-browser. Non-model Mastra workflow composed of FOSS tools only.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { downloadToFile } from '../lib/download.ts'

const MAX_CAPTURE_BYTES = 50 * 1024 * 1024

const mediaInput = z.object({
  url: z.string().url(),
  action: z.enum(['download', 'screenshot', 'pdf']).default('download'),
  dest: z.string().min(1),
  maxBytes: z.number().int().positive().optional(),
})

const mediaOutput = z.object({
  url: z.string(),
  savedTo: z.string(),
  bytes: z.number(),
  action: z.string(),
})

async function browserCapture(
  url: string,
  dest: string,
  action: 'screenshot' | 'pdf',
): Promise<number> {
  const res = await runBatch([['open', url], [action, dest], ['close']])
  if (res.code !== 0) throw new Error(`agent-browser ${action} failed: ${res.stderr.trim()}`)
  const size = Bun.file(dest).size
  if (size > MAX_CAPTURE_BYTES) throw new Error(`capture exceeded ${MAX_CAPTURE_BYTES} bytes`)
  return size
}

const mediaStep = createStep({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
  execute: async ({ inputData }) => {
    const { url, action, maxBytes } = inputData
    const dest = outPath(inputData.dest)
    if (action === 'download') {
      return { ...(await downloadToFile(url, dest, { maxBytes })), action }
    }
    return { url, savedTo: dest, bytes: await browserCapture(url, dest, action), action }
  },
})

export const mediaWorkflow = createWorkflow({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
})
  .then(mediaStep)
  .commit()
