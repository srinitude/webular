// The Stately agent's tools and knowledge stay in step with the code. Everything is
// derived from src/machines, src/tools, and src/commands, so a new machine, a renamed
// machine, or a changed tool id that skips the list, the enum, or the docs fails here.
// The machine ids and the machine.next replay live in stately-agent-reach.test.ts.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { mcpToolIds } from '../../src/tools/web.ts'
import { machineSchema } from '../../src/tools/web-machine.ts'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const read = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(`${ROOT}${path}`))

// Files in src/machines that build a machine; the agent files do not.
const machineFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(`${ROOT}src/machines`)).filter((f) => f.endsWith('.ts'))
  const texts = yield* Effect.forEach(files, (f) => read(`src/machines/${f}`))
  return files.filter((_, i) => texts[i]?.includes('.createMachine(')).sort()
})

const allFiles = Effect.flatMap(FileSystem.FileSystem, (fs) =>
  Effect.map(fs.readDirectory(`${ROOT}src/machines`), (files) =>
    files.filter((f) => f.endsWith('.ts')).sort(),
  ),
)

const camel = (file: string) =>
  file.replace(/\.ts$/, '').replace(/-(\w)/g, (_, c: string) => c.toUpperCase())

test(
  'the machine.next enum names exactly the machine files',
  eff(
    Effect.gen(function* () {
      const names = [...machineSchema.shape.machine.options].sort() as string[]
      expect(names).toEqual((yield* machineFiles).map(camel).sort())
    }),
  ),
)

test(
  'the diagram command lists exactly the machine files',
  eff(
    Effect.gen(function* () {
      const { out } = yield* runCli('src/commands/diagram.ts', ['--json'])
      const listed = (JSON.parse(out) as { diagrams: string[] }).diagrams
      expect(listed).toEqual((yield* machineFiles).map((f) => f.replace(/\.ts$/, '')))
    }),
  ),
  30_000,
)

test(
  'src/machines/AGENTS.md links every file in src/machines',
  eff(
    Effect.gen(function* () {
      const text = yield* read('src/machines/AGENTS.md')
      for (const file of yield* allFiles) expect(text, file).toContain(`](${file})`)
    }),
  ),
)

test(
  'docs/architecture.md links every machine file',
  eff(
    Effect.gen(function* () {
      const text = yield* read('docs/architecture.md')
      for (const file of yield* machineFiles)
        expect(text, file).toContain(`](../src/machines/${file})`)
    }),
  ),
)

test(
  'src/tools/AGENTS.md names every tool id that has a dot, and only those',
  eff(
    Effect.gen(function* () {
      const line = (yield* read('src/tools/AGENTS.md'))
        .split('\n')
        .find((l) => /ids have a `\.`/.test(l))
      const named = [...(line ?? '').matchAll(/`([a-z]+\.[a-z]+)`/g)].map((m) => m[1]).sort()
      expect(named).toEqual(mcpToolIds.filter((id) => id.includes('.')))
    }),
  ),
)
