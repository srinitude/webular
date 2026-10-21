// PARSE workflow: read local file → detect format → extract markdown.
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { inPath } from '../core/safepath.ts'
import { parseDocument } from '../lib/parse.ts'
import { stepRuntime } from './runtime.ts'

const parseInput = z.object({
  file: z.string().min(1),
})

const parseOutput = z.object({
  file: z.string(),
  format: z.string(),
  markdown: z.string(),
})

const parseStep = createStep({
  id: 'parse',
  inputSchema: parseInput,
  outputSchema: parseOutput,
  execute: ({ inputData }) =>
    stepRuntime.runPromise(
      Effect.gen(function* () {
        const result = yield* parseDocument(yield* inPath(inputData.file))
        return { file: result.file, format: result.format, markdown: result.markdown }
      }),
    ),
})

export const parseWorkflow = createWorkflow({
  id: 'parse',
  inputSchema: parseInput,
  outputSchema: parseOutput,
})
  .then(parseStep)
  .commit()
