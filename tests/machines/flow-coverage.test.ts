// Coverage of the flows by machines, generated from the code itself: every CLI
// command, every MCP tool, and the serve loop must name a machine, and every
// machine must have its own test in this folder. A new command or machine that
// skips either fails here.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { mcpToolIds, NOT_ON_MCP } from '../../src/tools/web.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

// Commands whose flow is not the shared command lifecycle: the machine file
// that models each one (`mcp` is the serve loop).
const OWN_MACHINE: Record<string, string> = { jev: 'jev-command', mcp: 'mcp-serve' }

const read = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(`${ROOT}${path}`))
const exists = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.exists(`${ROOT}${path}`))
const each = <A>(
  items: readonly A[],
  check: (item: A) => Effect.Effect<unknown, unknown, FileSystem.FileSystem>,
) => Effect.forEach(items, check, { concurrency: 8, discard: true })

const commandHasMachine = (cmd: string) =>
  Effect.gen(function* () {
    const own = OWN_MACHINE[cmd]
    if (own === undefined)
      return expect(yield* read(`src/commands/${cmd}.ts`), cmd).toMatch(
        /runWorkflow|commandLifecycleMachine/,
      )
    expect(yield* exists(`src/machines/${own}.ts`), cmd).toBe(true)
    expect(yield* exists(`tests/machines/${own}.test.ts`), cmd).toBe(true)
  })

test(
  'every command runs the lifecycle machine or has its own machine and test',
  eff(each(COMMAND_NAMES, commandHasMachine)),
)

test('every MCP tool is a command, a web tool, or machine.next', () => {
  const served = COMMAND_NAMES.filter((c) => !(c in NOT_ON_MCP)).sort()
  const named = mcpToolIds.filter((id) => !id.startsWith('web.') && id !== 'machine.next')
  expect(named).toEqual(served)
  expect(Object.keys(NOT_ON_MCP).every((c) => (COMMAND_NAMES as string[]).includes(c))).toBe(true)
})

const machineHasTest = (file: string) =>
  Effect.gen(function* () {
    const text = yield* read(`src/machines/${file}`)
    if (!text.includes('.createMachine(')) return
    expect(yield* exists(`tests/machines/${file.replace(/\.ts$/, '.test.ts')}`), file).toBe(true)
  })

test(
  'every machine file has a test of the same name',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      yield* each(yield* fs.readDirectory(`${ROOT}src/machines`), machineHasTest)
    }),
  ),
)
