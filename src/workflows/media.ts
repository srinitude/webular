// MEDIA workflow: download bytes (capped), or capture screenshot/PDF via
// agent-browser. Non-model Mastra workflow composed of FOSS tools only.

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { EXIT } from '../cli/exit-codes.ts'
import { CliError } from '../core/effect.ts'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { downloadToFile } from '../lib/download.ts'
import { MAX_CAPTURE_BYTES } from '../lib/driver-screenshot.ts'
import { refusalText, robotsGate } from '../lib/robots-gate.ts'
import { withArchiveCopy } from '../lib/sources/archive-copy.ts'
import { stepRuntime } from './runtime.ts'

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
  archivedFrom: z.string().optional(),
})

const fail = (message: string) => new CliError({ message, exitCode: EXIT.failure })
const robotsRefusal = (err: Parameters<typeof refusalText>[0]) => fail(refusalText(err))

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
  yield* robotsGate(url).pipe(Effect.mapError(robotsRefusal))
  const dest = yield* outPath(input.dest)
  if (action === 'download') {
    const opts = { maxBytes }
    const got = yield* withArchiveCopy(url, downloadToFile(url, dest, opts), (capture) =>
      downloadToFile(capture, dest, opts),
    )
    return { ...got.value, url, action, archivedFrom: got.archivedFrom }
  }
  return { url, savedTo: dest, bytes: yield* browserCapture(url, dest, action), action }
})

const mediaStep = createStep({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(media(inputData), { signal: abortSignal }),
})

export const mediaWorkflow = createWorkflow({
  id: 'media',
  inputSchema: mediaInput,
  outputSchema: mediaOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(mediaStep)
  .commit()
