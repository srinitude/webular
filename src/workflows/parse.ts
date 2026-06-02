// PARSE workflow: read local file → detect format → extract markdown.
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { parseDocument } from '../lib/parse.ts'

export const parseInput = z.object({
  file: z.string().min(1),
})

export const parseOutput = z.object({
  file: z.string(),
  format: z.string(),
  markdown: z.string(),
})

const parseStep = createStep({
  id: 'parse',
  inputSchema: parseInput,
  outputSchema: parseOutput,
  execute: async ({ inputData }) => {
    const result = await parseDocument(inputData.file)
    return { file: result.file, format: result.format, markdown: result.markdown }
  },
})

export const parseWorkflow = createWorkflow({
  id: 'parse',
  inputSchema: parseInput,
  outputSchema: parseOutput,
})
  .then(parseStep)
  .commit()
