// Machines in sync with the code they model. Each branch in the code is a
// marker string tied to the machine event that stands for it: the marker is in
// the code exactly when the event is in the machine, so a code branch missing
// from the machine, or a machine event with no code branch, fails here.
// Every workflow must also be run by a command, through the command lifecycle.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import type { AnyStateMachine } from 'xstate'
import { cliDispatchMachine } from '../../src/machines/cli-dispatch.ts'
import { commandLifecycleMachine } from '../../src/machines/command-lifecycle.ts'
import { scrapeFallbackMachine } from '../../src/machines/scrape-fallback.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const read = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(`${ROOT}${path}`))
const readAll = (dir: string) =>
  Effect.gen(function* () {
    const files = yield* (yield* FileSystem.FileSystem).readDirectory(`${ROOT}${dir}`)
    return yield* Effect.forEach(
      files.filter((f) => f.endsWith('.ts')),
      (f) => read(`${dir}/${f}`),
      { concurrency: 8 },
    )
  })
const names = (texts: ReadonlyArray<string>, re: RegExp) =>
  texts.flatMap((t) => [...t.matchAll(re)].map((m) => m[1] ?? ''))

// [machine, event, code file, marker that only that branch has]
const BRANCHES: ReadonlyArray<readonly [AnyStateMachine, string, string, string]> = [
  [scrapeFallbackMachine, 'ROBOTS_BLOCKED', 'src/workflows/scrape.ts', 'robotsGate('],
  [scrapeFallbackMachine, 'ARCHIVED', 'src/workflows/scrape.ts', 'fetchTextOrArchive('],
  [scrapeFallbackMachine, 'PDF_REFUSED', 'src/workflows/scrape-fallback.ts', 'isPdfRefusal'],
  [scrapeFallbackMachine, 'SHELL_RENDER_OFF', 'src/workflows/scrape-fallback.ts', "=== 'off'"],
  [scrapeFallbackMachine, 'RENDER_FAILED', 'src/workflows/scrape-fallback.ts', 'orElseSucceed('],
]

const inSync = ([machine, event, file, marker]: (typeof BRANCHES)[number]) =>
  Effect.map(read(file), (code) =>
    expect([event, machine.events.includes(event)]).toEqual([event, code.includes(marker)]),
  )

test(
  'each modeled branch is in the code exactly when its event is in the machine',
  eff(Effect.forEach(BRANCHES, inSync, { concurrency: 8, discard: true })),
)

test('every machine event is a marked branch or a plain step', () => {
  const tied = new Set(BRANCHES.map(([, event]) => event))
  const rest: string[] = scrapeFallbackMachine.events.filter((e) => !tied.has(e)).sort()
  // Steps every run has, with no branch of their own to mark.
  const plain = ['FETCHED', 'FETCH_FAILED', 'STATIC_PAGE', 'SHELL_RENDER_ON', 'RENDER_OK']
  expect(rest).toEqual([...plain, 'PDF_OK', 'PDF_FAILED'].sort())
})

test(
  'every workflow is run by a command through the lifecycle machine',
  eff(
    Effect.gen(function* () {
      const flows = names(
        yield* readAll('src/workflows'),
        /export const (\w+Workflow) = createWorkflow\(/g,
      )
      const run = new Set(names(yield* readAll('src/commands'), /m\.(\w+Workflow)/g))
      expect(flows.length).toBeGreaterThan(0)
      expect(flows.filter((n) => !run.has(n))).toEqual([])
    }),
  ),
)

// [machine, the code file that sends its events, whether that file sends all of them]
const SENDERS: ReadonlyArray<readonly [AnyStateMachine, string, boolean]> = [
  [commandLifecycleMachine, 'src/cli/run.ts', true],
  [cliDispatchMachine, 'src/cli/route.ts', false],
]

const sendsOnlyMachineEvents = ([machine, file, all]: (typeof SENDERS)[number]) =>
  Effect.map(read(file), (code) => {
    const sent = [...new Set(names([code], /type: '([A-Z_]+)'/g))].sort()
    expect(
      sent.filter((e) => !machine.events.includes(e)),
      file,
    ).toEqual([])
    if (all) expect(sent, file).toEqual([...machine.events].sort())
  })

test(
  'every event the code sends is a machine event, and the lifecycle has no unsent one',
  eff(Effect.forEach(SENDERS, sendsOnlyMachineEvents, { concurrency: 8, discard: true })),
)
