// DOCTOR workflow: run environment checks as a Mastra non-model workflow.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { runChecks } from '../lib/doctor.ts'

const checkSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  detail: z.string(),
})

const doctorInput = z.object({})

const doctorOutput = z.object({
  ok: z.boolean(),
  checks: z.array(checkSchema),
})

const checksStep = createStep({
  id: 'checks',
  inputSchema: doctorInput,
  outputSchema: doctorOutput,
  execute: async () => runChecks(),
})

export const doctorWorkflow = createWorkflow({
  id: 'doctor',
  inputSchema: doctorInput,
  outputSchema: doctorOutput,
})
  .then(checksStep)
  .commit()
