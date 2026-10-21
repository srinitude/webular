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
import { withArchiveCopy } from '../lib/sources/archive-copy.ts'
import { stepRuntime } from './runtime.ts'

const extractInput = z.object({
  url: z.url(),
  fields: z.string().optional(),
  selector: z.string().optional(),
  timeoutMs: z.number().optional(),
})

const archivedFrom = z.string().optional()
const fieldDataSchema = z.object({
  url: z.string(),
  data: z.record(z.string(), z.string()),
  archivedFrom,
})
const selectorDataSchema = z.object({
  url: z.string(),
  matches: z.array(z.string()),
  archivedFrom,
})
const extractOutput = z.union([fieldDataSchema, selectorDataSchema])

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: extractInput,
  outputSchema: z.object({
    url: z.string(),
    html: z.string(),
    archivedFrom,
    fields: z.string().optional(),
    selector: z.string().optional(),
  }),
  execute: ({ inputData }) => {
    const opts = { timeoutMs: inputData.timeoutMs }
    const fetched = withArchiveCopy(inputData.url, fetchText(inputData.url, opts), (capture) =>
      fetchText(capture, opts),
    )
    return stepRuntime.runPromise(
      Effect.map(fetched, ({ value: html, archivedFrom }) => ({
        url: inputData.url,
        html,
        archivedFrom,
        fields: inputData.fields,
        selector: inputData.selector,
      })),
    )
  },
})

const selectStep = createStep({
  id: 'select',
  inputSchema: z.object({
    url: z.string(),
    html: z.string(),
    archivedFrom,
    fields: z.string().optional(),
    selector: z.string().optional(),
  }),
  outputSchema: extractOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(select(inputData)),
})

function select(inputData: {
  url: string
  html: string
  archivedFrom?: string | undefined
  fields?: string | undefined
  selector?: string | undefined
}): Effect.Effect<z.infer<typeof extractOutput>, InvalidFieldSpecError> {
  const { url, html, fields, selector } = inputData
  const from = inputData.archivedFrom ? { archivedFrom: inputData.archivedFrom } : {}
  if (fields) {
    return Effect.flatMap(parseFieldSpecs(fields), (specs) =>
      Effect.map(selectFields(html, specs), (data) => ({ url, data, ...from })),
    )
  }
  if (selector) {
    return Effect.succeed({ url, matches: selectMatches(html, selector), ...from })
  }
  return Effect.succeed({ url, data: {}, ...from })
}

export const extractWorkflow = createWorkflow({
  id: 'extract',
  inputSchema: extractInput,
  outputSchema: extractOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(fetchStep)
  .then(selectStep)
  .commit()
