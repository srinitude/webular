// Input-bound contracts (P5): out-of-range inputs fail workflow validation
// BEFORE any network is touched — protects MCP/library consumers, not just
// the flag-checked CLI path. Mastra surfaces the zod rejection by throwing
// from run.start; a non-success status counts the same.
import { describe, expect, test } from 'bun:test'
import { answerWorkflow } from '../../src/workflows/answer.ts'
import { crawlWorkflow } from '../../src/workflows/crawl.ts'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { researchWorkflow } from '../../src/workflows/research.ts'

async function rejected(result: Promise<{ status: string }>): Promise<boolean> {
  try {
    return (await result).status !== 'success'
  } catch {
    return true
  }
}

describe('workflow input bounds reject before any fetch', () => {
  test('answer caps sources at 10', async () => {
    const run = await answerWorkflow.createRun({ runId: 'schema-test' })
    expect(await rejected(run.start({ inputData: { query: 'q', sources: 99 } }))).toBe(true)
  })

  test('research caps depth at 10', async () => {
    const run = await researchWorkflow.createRun({ runId: 'schema-test' })
    expect(await rejected(run.start({ inputData: { topic: 't', depth: 99 } }))).toBe(true)
  })

  test('crawl caps limit at 1000', async () => {
    const run = await crawlWorkflow.createRun({ runId: 'schema-test' })
    expect(
      await rejected(run.start({ inputData: { url: 'https://example.com', limit: 99_999 } })),
    ).toBe(true)
  })

  test('map caps limit at 10000', async () => {
    const run = await mapWorkflow.createRun({ runId: 'schema-test' })
    expect(
      await rejected(run.start({ inputData: { url: 'https://example.com', limit: 999_999 } })),
    ).toBe(true)
  })
})
