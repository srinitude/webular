// MEDIA workflow: download bytes (capped), or capture screenshot/PDF via
// agent-browser. Non-model Mastra workflow composed of FOSS tools only.

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { z } from 'zod'
import { EXIT } from '../cli/exit-codes.ts'
import { CliError } from '../core/effect.ts'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { downloadToFile } from '../lib/download.ts'
import { MAX_CAPTURE_BYTES } from '../lib/driver-screenshot.ts'
import { mediaUrlsFrom } from '../lib/html-images.ts'
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
  media: z.array(z.string()).optional(),
})

const fail = (message: string) => new CliError({ message, exitCode: EXIT.failure })
const robotsRefusal = (err: Parameters<typeof refusalText>[0]) => fail(refusalText(err))

// A downloaded HTML page also reports every media URL it links (img, srcset,
// picture/video/audio sources, og:image), so the next download is one step.
const MAX_PAGE_BYTES = 5 * 1024 * 1024
const pageMedia = Effect.fn('media.pageMedia')(function* (dest: string, pageUrl: string) {
  const file = Bun.file(dest)
  if (file.size > MAX_PAGE_BYTES) return undefined
  const text = yield* Effect.tryPromise({
    try: () => file.text(),
    catch: () => fail(`media: could not read ${dest}`),
  })
  if (!/^\s*(<!doctype html|<html)/i.test(text)) return undefined
  return mediaUrlsFrom(parseHTML(text).document, pageUrl)
})

const browserCapture = Effect.fn('media.browserCapture')(function* (
  url: string,
  dest: string,
  action: 'screenshot' | 'pdf',
) {
  // A warm session per URL: a repeat capture skips the browser launch, and two
  // captures of different pages never share one tab. The daemon idles out.
  const session = `webular-media-${Bun.hash(url).toString(36)}`
  const res = yield* runBatch(
    [
      ['open', url],
      [action, dest],
    ],
    session,
  )
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
    const found = yield* pageMedia(dest, url)
    return { ...got.value, url, action, archivedFrom: got.archivedFrom, media: found }
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
