// The command tools both MCP servers register: one per webular command that
// is not the MCP server itself, each named in the CLI's command table.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { COMMAND_NAMES } from '../../../src/cli/commands.ts'
import { NOT_ON_MCP } from '../../../src/tools/web.ts'
import { commandTools } from '../src/commands.ts'

const ids: string[] = commandTools.map((tool) => tool.id)

test('the list holds the 19 command tools, with unique names', () =>
  Effect.runPromise(
    Effect.sync(() => {
      expect(ids).toHaveLength(19)
      expect(new Set(ids).size).toBe(ids.length)
    }),
  ))

test('every tool is a CLI command, and only the NOT_ON_MCP commands have none', () =>
  Effect.runPromise(
    Effect.sync(() => {
      for (const id of ids) expect(COMMAND_NAMES as string[]).toContain(id)
      const without: string[] = COMMAND_NAMES.filter((name) => !ids.includes(name))
      expect(without.sort()).toEqual(Object.keys(NOT_ON_MCP).sort())
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
