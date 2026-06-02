// DIAGRAM workflow: list or render .mmd diagrams, composed as a
// Mastra non-model workflow over FOSS tools (mmdc via bunx).
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// Resolve relative to this module so it works in-repo AND when npm-installed.
const DIAGRAMS_DIR = new URL('../../docs/diagrams', import.meta.url).pathname

export const diagramInput = z.object({
  list: z.boolean().optional(),
  dir: z.string().optional(),
})

export const diagramListOutput = z.object({
  count: z.number(),
  diagrams: z.array(z.string()),
})

export const diagramRenderOutput = z.object({
  rendered: z.array(z.string()),
})

async function listMmd(dir: string): Promise<string[]> {
  const entries = await readdir(dir)
  return entries.filter((f) => f.endsWith('.mmd')).sort()
}

async function renderOne(dir: string, file: string): Promise<string> {
  const input = join(dir, file)
  const output = join(dir, file.replace(/\.mmd$/, '.svg'))
  const proc = Bun.spawn(['bunx', 'mmdc', '-i', input, '-o', output], { stderr: 'pipe' })
  if ((await proc.exited) !== 0) {
    const err = await new Response(proc.stderr).text()
    throw new Error(`mmdc failed for ${file}: ${err.trim()}`)
  }
  return file.replace(/\.mmd$/, '')
}

const listStep = createStep({
  id: 'list',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
  execute: async ({ inputData }) => {
    const files = await listMmd(inputData.dir ?? DIAGRAMS_DIR)
    const diagrams = files.map((f) => f.replace(/\.mmd$/, ''))
    return { count: diagrams.length, diagrams }
  },
})

const renderStep = createStep({
  id: 'render',
  inputSchema: diagramInput,
  outputSchema: diagramRenderOutput,
  execute: async ({ inputData }) => {
    const dir = inputData.dir ?? DIAGRAMS_DIR
    const rendered: string[] = []
    for (const file of await listMmd(dir)) rendered.push(await renderOne(dir, file))
    return { rendered }
  },
})

export const diagramWorkflow = createWorkflow({
  id: 'diagram',
  inputSchema: diagramInput,
  outputSchema: z.union([diagramListOutput, diagramRenderOutput]),
})
  .then(listStep)
  .commit()

export const diagramRenderWorkflow = createWorkflow({
  id: 'diagram-render',
  inputSchema: diagramInput,
  outputSchema: diagramRenderOutput,
})
  .then(renderStep)
  .commit()
