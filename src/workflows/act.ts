// ACT workflow: drive a real browser via the agent-browser CLI (open ->
// snapshot [-> screenshot] -> close), composed as a Mastra non-model workflow.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { outPath } from '../core/safepath.ts'
import { runBatch } from '../lib/agentbrowser.ts'

const actInput = z.object({
  url: z.string().url(),
  screenshot: z.string().optional(),
})

const actOutput = z.object({
  url: z.string(),
  snapshot: z.string(),
  screenshot: z.string().optional(),
})

const actStep = createStep({
  id: 'act',
  inputSchema: actInput,
  outputSchema: actOutput,
  execute: async ({ inputData }) => {
    const cmds: string[][] = [['open', inputData.url], ['snapshot']]
    if (inputData.screenshot) cmds.push(['screenshot', outPath(inputData.screenshot)])
    cmds.push(['close'])
    const res = await runBatch(cmds)
    if (res.code !== 0) throw new Error(`agent-browser failed: ${res.stderr.trim()}`)
    return { url: inputData.url, snapshot: res.stdout.trim(), screenshot: inputData.screenshot }
  },
})

export const actWorkflow = createWorkflow({
  id: 'act',
  inputSchema: actInput,
  outputSchema: actOutput,
})
  .then(actStep)
  .commit()
