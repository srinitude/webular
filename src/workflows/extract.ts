// EXTRACT workflow: fetch → CSS-selector extraction, composed as a Mastra
// non-model workflow over FOSS tools (linkedom).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { parseFieldSpecs, selectFields, selectMatches } from '../lib/select.ts'

export const extractInput = z.object({
  url: z.string().url(),
  fields: z.string().optional(),
  selector: z.string().optional(),
  timeoutMs: z.number().optional(),
})

const fieldDataSchema = z.object({ url: z.string(), data: z.record(z.string(), z.string()) })
const selectorDataSchema = z.object({ url: z.string(), matches: z.array(z.string()) })
export const extractOutput = z.union([fieldDataSchema, selectorDataSchema])

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: extractInput,
  outputSchema: z.object({
    url: z.string(),
    html: z.string(),
    fields: z.string().optional(),
    selector: z.string().optional(),
  }),
  execute: async ({ inputData }) => ({
    url: inputData.url,
    html: await fetchText(inputData.url, { timeoutMs: inputData.timeoutMs }),
    fields: inputData.fields,
    selector: inputData.selector,
  }),
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
  execute: async ({ inputData }) => {
    const { url, html, fields, selector } = inputData
    if (fields) {
      const specs = parseFieldSpecs(fields)
      return { url, data: selectFields(html, specs) }
    }
    if (selector) {
      return { url, matches: selectMatches(html, selector) }
    }
    return { url, data: {} }
  },
})

export const extractWorkflow = createWorkflow({
  id: 'extract',
  inputSchema: extractInput,
  outputSchema: extractOutput,
})
  .then(fetchStep)
  .then(selectStep)
  .commit()
