// Parity: every surface in the generated e2e coverage map (each command,
// command flag, shared flag, MCP tool, MCP tool input, plugin tool, skill,
// and the executable)
// has at least one e2e case. A new surface with no case fails this test.
import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { CLI_CASES, type CliCase, MCP_CASES, type McpCase, PLUGIN_CASES } from '../e2e/cases.ts'
import { coverage, coverageRows } from '../e2e/surface.ts'

const covered = (cli: CliCase[], mcp: McpCase[], [kind, item]: [string, string]): boolean => {
  const [head = '', tail = ''] = item.split(' ')
  if (kind === 'command') return cli.some((c) => c.cmd === item)
  if (kind === 'flag') return cli.some((c) => c.cmd === head && c.args.includes(tail))
  if (kind === 'shared flag') return cli.some((c) => c.args.includes(item))
  if (kind === 'plugin tool' || kind === 'skill')
    return PLUGIN_CASES.some((c) => c.covers.includes(kind))
  if (kind === 'mcp tool') return mcp.some((c) => c.tool === item)
  if (kind === 'mcp input') {
    const dot = item.lastIndexOf('.')
    return mcp.some((c) => c.tool === item.slice(0, dot) && item.slice(dot + 1) in c.args)
  }
  return cli.some((c) => c.via === 'exe')
}

describe('e2e coverage parity', () => {
  test('an uncovered surface is reported', () => {
    expect(covered([], [], ['command', 'search'])).toBe(false)
    expect(covered([], [], ['mcp input', 'web.fetch.url'])).toBe(false)
  })

  test('every surface in the coverage map has an e2e case', () =>
    Effect.runPromise(
      coverage.pipe(
        Effect.map((c) => coverageRows(c).filter((row) => !covered(CLI_CASES, MCP_CASES, row))),
        Effect.map((missing) => expect(missing).toEqual([])),
        Effect.provide(BunServices.layer),
      ),
    ))
})
