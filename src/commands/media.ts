// MEDIA command entry — invoked by `mise run run:media`. Parses flags,
// runs the Mastra media workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { optIntFlag, parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

function resolveAction(values: Record<string, unknown>): 'download' | 'screenshot' | 'pdf' {
  if (values['screenshot']) return 'screenshot'
  if (values['pdf']) return 'pdf'
  return 'download'
}

function buildInput(values: Record<string, string | boolean | string[] | undefined>) {
  return Effect.gen(function* () {
    const url = values['url'] as string | undefined
    if (!url) {
      return yield* new CliError({ message: 'media: missing --url <url>', exitCode: EXIT.usage })
    }
    const dest = values['output'] as string | undefined
    if (!dest) {
      return yield* new CliError({
        message: 'media: -o <file> is required. It says where to save the result.',
        exitCode: EXIT.usage,
      })
    }
    return {
      url,
      action: resolveAction(values),
      dest,
      maxBytes: yield* optIntFlag('media', values, 'max-bytes', { min: 1, max: 1_000_000_000 }),
    }
  })
}

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    download: { type: 'boolean', default: false },
    screenshot: { type: 'boolean', default: false },
    pdf: { type: 'boolean', default: false },
    'max-bytes': { type: 'string' },
  })
  const inputData = yield* buildInput(values)
  return yield* runWorkflow(
    'media',
    () => import('../workflows/media.ts'),
    (m) => m.mediaWorkflow,
    inputData,
    { json: Boolean(values['json']) },
  )
})

runMain(main)
