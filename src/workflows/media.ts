// MEDIA workflow: download bytes (capped), or capture screenshot/PDF via
// agent-browser. Non-model Mastra workflow composed of FOSS tools only.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { CliError } from '../core/effect.ts'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { downloadToFile } from '../lib/download.ts'
import { stepRuntime } from './runtime.ts'

const MAX_CAPTURE_BYTES = 50 * 1024 * 1024

const mediaInput = z.object({
  url: z.url(),
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

const fail = (message: string) => new CliError({ message, exitCode: 1 })

const browserCapture = Effect.fn('media.browserCapture')(function* (
  url: string,
  dest: string,
  action: 'screenshot' | 'pdf',
) {
  const res = yield* runBatch([['open', url], [action, dest], ['close']])
  if (res.code !== 0) return yield* fail(`agent-browser ${action} failed: ${res.stderr.trim()}`)
  const size = Bun.file(dest).size
  if (size > MAX_CAPTURE_BYTES) return yield* fail(`capture exceeded ${MAX_CAPTURE_BYTES} bytes`)
  return size
})

const media = Effect.fn('media')(function* (input: z.infer<typeof mediaInput>) {
  const { url, action, maxBytes } = input
  const dest = yield* outPath(input.dest)
  if (action === 'download') return { ...(yield* downloadToFile(url, dest, { maxBytes })), action }
  return { url, savedTo: dest, bytes: yield* browserCapture(url, dest, action), action }
})

const mediaStep = createStep({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(media(inputData)),
})

export const mediaWorkflow = createWorkflow({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
})
  .then(mediaStep)
  .commit()
