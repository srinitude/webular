// Model-based test: every path of the command lifecycle machine, replayed
// against the real runWorkflow with a real Mastra workflow.

import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { discoveryExit, runWorkflow } from '../../src/cli/run.ts'
import { commandLifecycleMachine } from '../../src/machines/command-lifecycle.ts'
import { exitCodeOf, finalPaths } from '../_support/paths.ts'

const io = z.object({ items: z.array(z.string()), errors: z.array(z.string()), fail: z.boolean() })
const step = createStep({
  id: 'work',
  inputSchema: io,
  outputSchema: io,
  execute: async ({ inputData }) => {
    if (inputData.fail) throw new Error('workflow step failed')
    return inputData
  },
})
const workflow = createWorkflow({ id: 'lifecycle', inputSchema: io, outputSchema: io })
  .then(step)
  .commit()

const INPUT_FOR_PATH: Record<string, unknown> = {
  INPUT_INVALID: { items: 'not a list' },
  'INPUT_VALID WORKFLOW_FAILED': { items: [], errors: [], fail: true },
  'INPUT_VALID WORKFLOW_SUCCEEDED NO_ERRORS': { items: ['a'], errors: [], fail: false },
  'INPUT_VALID WORKFLOW_SUCCEEDED SOME_ERRORS': { items: ['a'], errors: ['e'], fail: false },
  'INPUT_VALID WORKFLOW_SUCCEEDED EMPTY_WITH_ERRORS': { items: [], errors: ['e'], fail: false },
}

const dir = mkdtempSync(join(tmpdir(), 'webular-lifecycle-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const paths = finalPaths(commandLifecycleMachine, [
  'INPUT_INVALID',
  'INPUT_VALID',
  'WORKFLOW_FAILED',
  'WORKFLOW_SUCCEEDED',
  'NO_ERRORS',
  'SOME_ERRORS',
  'EMPTY_WITH_ERRORS',
])

describe('command lifecycle machine matches runWorkflow', () => {
  test('the model has one scenario per path', () => {
    expect(paths.map((p) => p.events.join(' ')).sort()).toEqual(Object.keys(INPUT_FOR_PATH).sort())
  })

  test.each(paths.map((p) => [p.final, p] as const))('%s', async (name, path) => {
    const stderr = spyOn(process.stderr, 'write')
    const opts = { json: true, output: join(dir, `${name}.json`), exitCode: discoveryExit('items') }
    const input = INPUT_FOR_PATH[path.events.join(' ')]
    const code = await runWorkflow(name, workflow, input, opts)
    const noted = stderr.mock.calls.some((c) => String(c[0]).includes('fetch'))
    stderr.mockRestore()
    expect(code).toBe(exitCodeOf(path))
    expect(noted).toBe(path.tags.includes('stderr-note'))
  })
})
