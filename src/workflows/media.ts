// MEDIA workflow: download bytes (capped), or capture screenshot/PDF via
// agent-browser. Non-model Mastra workflow composed of FOSS tools only.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { safePath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { downloadToFile } from '../lib/download.ts'

export const mediaInput = z.object({
  url: z.string().url(),
  action: z.enum(['download', 'screenshot', 'pdf']).default('download'),
  dest: z.string().optional(),
  maxBytes: z.number().int().positive().optional(),
})

export const mediaOutput = z.object({
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
  return (await Bun.file(dest).arrayBuffer()).byteLength
}

const mediaStep = createStep({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
  execute: async ({ inputData }) => {
    const { url, action, maxBytes } = inputData
    const dest = inputData.dest ? safePath(inputData.dest) : undefined
    if (action === 'download') {
      return { ...(await downloadToFile(url, dest, maxBytes)), action }
    }
    if (!dest) throw new Error('media: -o <file> is required for screenshot/pdf')
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
