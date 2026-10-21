// ACT workflow: drive a real browser via the agent-browser CLI (open ->
// snapshot [-> screenshot] -> close), composed as a Mastra non-model workflow.

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { EXIT } from '../cli/exit-codes.ts'
import { CliError } from '../core/effect.ts'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { stepRuntime } from './runtime.ts'

const actInput = z.object({
  url: z.url(),
  screenshot: z.string().optional(),
})

const actOutput = z.object({
  url: z.string(),
  snapshot: z.string(),
  screenshot: z.string().optional(),
})

const act = Effect.fn('act')(function* (input: z.infer<typeof actInput>) {
  const cmds: string[][] = [['open', input.url], ['snapshot']]
  if (input.screenshot) cmds.push(['screenshot', yield* outPath(input.screenshot)])
  cmds.push(['close'])
  const res = yield* runBatch(cmds)
  if (res.code !== 0)
    return yield* new CliError({
      message: `agent-browser failed: ${res.stderr.trim()}`,
      exitCode: EXIT.failure,
    })
  return { url: input.url, snapshot: res.stdout.trim(), screenshot: input.screenshot }
})

const actStep = createStep({
  id: 'act',
  inputSchema: actInput,
  outputSchema: actOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(act(inputData)),
})

export const actWorkflow = createWorkflow({
  id: 'act',
  inputSchema: actInput,
  outputSchema: actOutput,
})
  .then(actStep)
  .commit()
