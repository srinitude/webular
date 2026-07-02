// DIAGRAM workflow: list the design diagrams. The SVGs are pre-rendered and
// committed; regeneration is a maintainer activity (see docs/diagrams/README)
// because mmdc needs a Puppeteer browser that fresh installs never have.
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { PACKAGE_ROOT } from '../core/root.ts'

const DIAGRAMS_DIR = join(PACKAGE_ROOT, 'docs/diagrams')

const diagramInput = z.object({})

const diagramListOutput = z.object({
  count: z.number(),
  diagrams: z.array(z.string()),
})

const listStep = createStep({
  id: 'list',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
  execute: async () => {
    const entries = await readdir(DIAGRAMS_DIR)
    const diagrams = entries
      .filter((f) => f.endsWith('.mmd'))
      .sort()
      .map((f) => f.replace(/\.mmd$/, ''))
    return { count: diagrams.length, diagrams }
  },
})

export const diagramWorkflow = createWorkflow({
  id: 'diagram',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
})
  .then(listStep)
  .commit()
