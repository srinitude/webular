// DIAGRAM contract — lists .mmd files without rendering (no mmdc needed).
import { describe, expect, test } from 'bun:test'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

const runDiagram = (args: string[]) => runCli('src/commands/diagram.ts', args)

describe('webular diagram — list .mmd files', () => {
  test('diagram --list --json exits 0 and returns diagram list', async () => {
    const { code, out } = await runDiagram(['--list', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.count).toBe('number')
    expect(data.count).toBeGreaterThanOrEqual(7)
    expect(Array.isArray(data.diagrams)).toBe(true)
    expect(data.diagrams).toContain('01-sequence')
  }, 15_000)

  test('diagram without flags also lists (render path removed)', async () => {
    const { code, out } = await runDiagram(['--json'])
    expect(code).toBe(0)
    expect(JSON.parse(out).diagrams).toContain('01-sequence')
  }, 30_000)
})
