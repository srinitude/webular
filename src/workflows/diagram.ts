// DIAGRAM workflow: list the XState machines in src/machines, one per CLI
// flow. A file counts only when it builds a machine; the agent files do not.
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

const listDiagrams = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(MACHINES_DIR)).filter((f) => f.endsWith('.ts')).sort()
  const isMachine = (f: string) =>
    Effect.map(fs.readFileString(join(MACHINES_DIR, f)), (text) => text.includes('.createMachine('))
  const flags = yield* Effect.forEach(files, isMachine, { concurrency: 8 })
  const diagrams = files.filter((_, i) => flags[i]).map((f) => f.replace(/\.ts$/, ''))
  return { count: diagrams.length, diagrams }
}).pipe(Effect.mapError((err) => new CliError({ message: errMsg(err), exitCode: EXIT.failure })))

const listStep = createStep({
  id: 'list',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
  execute: ({ abortSignal }) => stepRuntime.runPromise(listDiagrams, { signal: abortSignal }),
})

export const diagramWorkflow = createWorkflow({
  id: 'diagram',
  inputSchema: diagramInput,
  outputSchema: diagramListOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(listStep)
  .commit()
