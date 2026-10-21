// DIAGRAM workflow: list the XState machines in src/machines, one per CLI
// flow (dispatch, command lifecycle, fetch).
import { join } from 'node:path'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect, FileSystem } from 'effect'
import { z } from 'zod'
import { EXIT } from '../cli/exit-codes.ts'
import { CliError } from '../core/effect.ts'
import { errMsg } from '../core/output.ts'
import { PACKAGE_ROOT } from '../core/root.ts'
import { stepRuntime } from './runtime.ts'

const MACHINES_DIR = join(PACKAGE_ROOT, 'src/machines')

const diagramInput = z.object({})

const diagramListOutput = z.object({
  count: z.number(),
  diagrams: z.array(z.string()),
})

const listDiagrams = Effect.map(
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readDirectory(MACHINES_DIR)).pipe(
    Effect.mapError((err) => new CliError({ message: errMsg(err), exitCode: EXIT.failure })),
  ),
  (entries) => {
    const diagrams = entries
      .filter((f) => f.endsWith('.ts'))
      .sort()
      .map((f) => f.replace(/\.ts$/, ''))
    return { count: diagrams.length, diagrams }
  },
)

const listStep = createStep({
  id: 'list',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
  execute: () => stepRuntime.runPromise(listDiagrams),
})

export const diagramWorkflow = createWorkflow({
  id: 'diagram',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(listStep)
  .commit()
