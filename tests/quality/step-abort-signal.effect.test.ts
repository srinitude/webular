// Every Mastra step that runs an Effect forwards its abortSignal, so a
// cancelled run (Ctrl-C) interrupts the step's fetches and child processes.
// A decisionStep `prepare:` hook gets no signal and is not counted.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0

test(
  'each workflow step forwards its abortSignal to stepRuntime',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = `${ROOT}src/workflows`
      const names = (yield* fs.readDirectory(dir)).filter((n) => n.endsWith('.ts'))
      const missing: string[] = []
      for (const name of names.filter((n) => n !== 'runtime.ts')) {
        const text = yield* fs.readFileString(`${dir}/${name}`)
        const runs = count(text, /stepRuntime\.runPromise\(/g)
        const prepares = count(text, /prepare:[^\n]*stepRuntime\.runPromise\(/g)
        if (count(text, /signal: abortSignal/g) < runs - prepares) missing.push(name)
      }
      expect(missing).toEqual([])
    }),
  ),
)
