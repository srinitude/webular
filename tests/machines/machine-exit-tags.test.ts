// Machines and code stay in sync: every event a machine declares is sent by
// the code it models, and every exit code that code can end with is an
// `exit-<code>` tag in the machine. A machine path the code never takes, or an
// exit the machine never names, fails here.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { EXIT } from '../../src/cli/exit-codes.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

type ExitName = keyof typeof EXIT

// Each machine, the code that sends its events, and the exits that code passes
// through from a child process (the router hands back a command's own exit).
const SYNC: Record<string, { code: string[]; passesThrough?: ExitName[] }> = {
  'cli-dispatch': {
    code: ['src/cli/route.ts', 'src/cli/dispatch.ts'],
    passesThrough: Object.keys(EXIT) as ExitName[],
  },
  'jev-command': { code: ['src/commands/jev.ts'] },
}

const read = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(`${ROOT}${path}`))

const all = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1] ?? '')

for (const [machine, { code, passesThrough = [] }] of Object.entries(SYNC)) {
  test(
    `${machine}: every event is sent and every exit is tagged`,
    eff(
      Effect.gen(function* () {
        const model = yield* read(`src/machines/${machine}.ts`)
        const source = (yield* Effect.forEach(code, read)).join('\n')
        const events = all(model, /type: '([A-Z_]+)'/g)
        expect(events.filter((e) => !source.includes(`'${e}'`))).toEqual([])
        const tagged = new Set(all(model, /exitTag\(EXIT\.(\w+)\)/g))
        const exits = new Set([...all(source, /EXIT\.(\w+)/g), ...passesThrough])
        expect([...exits].filter((e) => !tagged.has(e))).toEqual([])
      }),
    ),
  )
}
