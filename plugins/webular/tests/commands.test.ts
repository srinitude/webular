// The command tools both MCP servers register: one per webular command that
// is not the MCP server itself, each named in the CLI's command table.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { COMMAND_NAMES } from '../../../src/cli/commands.ts'
import { commandTools } from '../src/commands.ts'

const ids: string[] = commandTools.map((tool) => tool.id)

test('the list holds the 18 command tools, with unique names', () =>
  Effect.runPromise(
    Effect.sync(() => {
      expect(ids).toHaveLength(18)
      expect(new Set(ids).size).toBe(ids.length)
    }),
  ))

test('every tool is a CLI command, and mcp is the only command without one', () =>
  Effect.runPromise(
    Effect.sync(() => {
      for (const id of ids) expect(COMMAND_NAMES as string[]).toContain(id)
      expect(COMMAND_NAMES.filter((name) => !ids.includes(name))).toEqual(['mcp'])
    }),
  ))

test('every tool has a non-empty title and description', () =>
  Effect.runPromise(
    Effect.sync(() => {
      for (const tool of commandTools) {
        expect(tool.title.trim()).not.toBe('')
        expect(tool.description.trim()).not.toBe('')
      }
    }),
  ))
