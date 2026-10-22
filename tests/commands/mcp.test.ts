// MCP command test — fast, no server start needed.
// Verifies that `mcp --list --json` returns code 0 and includes "web.fetch".
import { describe, expect, test } from 'bun:test'

import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const runMcp = (args: string[]) => runCli('src/commands/mcp.ts', args)

describe('webular mcp — MCP server tool listing', () => {
  test(
    '--list --json exits 0 and includes web.fetch',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runMcp(['--list', '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(typeof data.count).toBe('number')
        expect(data.count).toBeGreaterThan(0)
        expect(Array.isArray(data.tools)).toBe(true)
        expect(data.tools).toContain('web.fetch')
      }),
    ),
    15_000,
  )

  // A stdio MCP server lives as long as its stdin: it answers what arrives,
  // then exits 0 once stdin closes.
  test(
    'serves until stdin closes, then exits 0',
    eff(
      Effect.gen(function* () {
        const init = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 't', version: '0' },
          },
        }
        const { code, stdout } = yield* runProc(['bun', `${ROOT}src/commands/mcp.ts`], {
          cwd: ROOT,
          timeoutMs: 12_000,
          stdin: `${JSON.stringify(init)}\n`,
        })
        expect(code).toBe(0)
        expect(stdout).toContain('"serverInfo"')
        // The client shows these instructions to the model: steer many URLs to batch.
        expect(JSON.parse(stdout.split('\n')[0] ?? '').result.instructions).toMatch(
          /^When you have two or more URLs, call batch once instead of calling scrape for each\. Built on Mastra and Jev: with TYPESAFE_API_KEY set, judgment calls go to Jev; without it, rules decide\.$/,
        )
      }),
    ),
    15_000,
  )

  test(
    '--list exits 0 and outputs tool count and names',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runMcp(['--list'])
        expect(code).toBe(0)
        expect(out).toContain('web.fetch')
      }),
    ),
    15_000,
  )
})
