// Leak check (spec-integrity-and-report.md, "Contamination and leakage"; guard
// test 6): webular's source tree must hold no canary string and no sealed task
// input text. Returns one "path: what" line per leak found.
import { Effect, FileSystem } from 'effect'
import type { TaskFile } from './schema.ts'

// The strings that must never appear in source: the canary and each sealed input.
export const leakNeedles = (file: TaskFile): string[] => [
  file.canary,
  ...file.tasks.filter((t) => t.split === 'sealed').map((t) => t.input),
]

const scanFile = (fs: FileSystem.FileSystem, path: string, needles: readonly string[]) =>
  fs.readFileString(path).pipe(
    Effect.map((text) => needles.filter((n) => n !== '' && text.includes(n))),
    Effect.map((hits) => hits.map((n) => `${path}: ${n.slice(0, 60)}`)),
    Effect.orElseSucceed((): string[] => []),
  )

// ponytail: reads every file whole; stream or skip binaries if the tree grows large.
export const findLeaks = (srcDir: string, needles: readonly string[]) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const entries = yield* fs.readDirectory(srcDir, { recursive: true })
    const found = yield* Effect.forEach(entries, (e) => scanFile(fs, `${srcDir}/${e}`, needles), {
      concurrency: 8,
    })
    return found.flat()
  })
