// EXTRACT workflow: fetch → CSS-selector extraction, composed as a Mastra
// non-model workflow over FOSS tools (linkedom).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import {
  type InvalidFieldSpecError,
  parseFieldSpecs,
  selectFields,
  selectMatches,
} from '../lib/select.ts'
import { stepRuntime } from './runtime.ts'

const extractInput = z.object({
  url: z.url(),
  fields: z.string().optional(),
  selector: z.string().optional(),
  timeoutMs: z.number().optional(),
})

const fieldDataSchema = z.object({ url: z.string(), data: z.record(z.string(), z.string()) })
const selectorDataSchema = z.object({ url: z.string(), matches: z.array(z.string()) })
const extractOutput = z.union([fieldDataSchema, selectorDataSchema])

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: extractInput,
  outputSchema: z.object({
    url: z.string(),
    html: z.string(),
    fields: z.string().optional(),
    selector: z.string().optional(),
  }),
  execute: ({ inputData }) =>
    stepRuntime.runPromise(
      Effect.map(fetchText(inputData.url, { timeoutMs: inputData.timeoutMs }), (html) => ({
        url: inputData.url,
        html,
        fields: inputData.fields,
        selector: inputData.selector,
      })),
    ),
})

const selectStep = createStep({
  id: 'select',
  inputSchema: z.object({
    url: z.string(),
    html: z.string(),
    fields: z.string().optional(),
    selector: z.string().optional(),
  }),
  outputSchema: extractOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(select(inputData)),
})

function select(inputData: {
  url: string
  html: string
  fields?: string | undefined
  selector?: string | undefined
}): Effect.Effect<z.infer<typeof extractOutput>, InvalidFieldSpecError> {
  const { url, html, fields, selector } = inputData
  if (fields) {
    return Effect.flatMap(parseFieldSpecs(fields), (specs) =>
      Effect.map(selectFields(html, specs), (data) => ({ url, data })),
    )
  }
  if (selector) {
    return Effect.succeed({ url, matches: selectMatches(html, selector) })
  }
  return Effect.succeed({ url, data: {} })
}

export const extractWorkflow = createWorkflow({
  id: 'extract',
  inputSchema: extractInput,
  outputSchema: extractOutput,
})
  .then(fetchStep)
  .then(selectStep)
  .commit()
