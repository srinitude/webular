// ACT workflow: drive a real browser via the agent-browser CLI (open ->
// snapshot [-> screenshot] -> close), composed as a Mastra non-model workflow.

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { EXIT } from '../cli/exit-codes.ts'
import { CliError } from '../core/effect.ts'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'
import { actCandidates } from '../lib/jev/decisions/act.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { stepRuntime } from './runtime.ts'

const actInput = z.object({
  url: z.url(),
  screenshot: z.string().optional(),
  goal: z.string().optional(),
})

const actOutput = z.object({
  url: z.string(),
  snapshot: z.string(),
  screenshot: z.string().optional(),
  next: z.string().optional(),
})

// What the browser run hands to the next-click decision.
const browsed = actOutput.omit({ next: true }).extend({ goal: z.string().optional() })

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
  return {
    url: input.url,
    snapshot: res.stdout.trim(),
    screenshot: input.screenshot,
    goal: input.goal,
  }
})

const actStep = createStep({
  id: 'act',
  inputSchema: actInput,
  outputSchema: browsed,
  execute: ({ inputData }) => stepRuntime.runPromise(act(inputData)),
})

// With a goal, Jev picks the next element to click (a ref, or none).
const nextStep = decisionStep({
  id: 'next',
  inputSchema: browsed,
  outputSchema: actOutput,
  decide: decisions.act,
  prepare: ({ goal, ...r }) => ({ r, goal, candidates: actCandidates(r.snapshot) }),
  pick: ({ goal, candidates }) =>
    goal && candidates.length > 0 ? { goal, candidates } : undefined,
  output: ({ r, goal }, next) => (goal ? { ...r, next: next ?? 'none' } : r),
})

export const actWorkflow = createWorkflow({
  id: 'act',
  inputSchema: actInput,
  outputSchema: actOutput,
})
  .then(actStep)
  .then(nextStep)
  .commit()
