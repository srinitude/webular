// Guard: scripts/bugs-check.ts (mise run bugs:check) finds a planted instance
// of each bug class, passes once it is removed, and passes on the repo itself.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { RULES, scan } from '../../scripts/bugs-check.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

// One planted line per rule, in a file that rule covers.
const PLANTS: ReadonlyArray<readonly [file: string, line: string]> = [
  ['src/commands/mcp.ts', "console.log('ready')"],
  ['src/lib/a.ts', 'const x = y as any'],
  ['src/lib/b.ts', 'const v = JSON.parse(body) as Row'],
  ['scripts/c.ts', "spawn('ls -la', { shell: true })"],
  ['src/core/d.ts', 'const res = await fetch(url)'],
]

const plant = (dir: string, file: string, line: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(`${dir}/${file.slice(0, file.lastIndexOf('/'))}`, { recursive: true })
    yield* fs.writeFileString(`${dir}/${file}`, `${line}\n`)
  })

describe('bugs:check static guards', () => {
  test('there is one plant per rule', () => expect(PLANTS.length).toBe(RULES.length))

  for (const [i, [file, line]] of PLANTS.entries())
    test(
      `fails on a planted hit, then passes: ${RULES[i]?.name}`,
      eff(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const dir = yield* tmpDir('bugs-check-')
          yield* plant(dir, file, line)
          const before = yield* scan(dir)
          expect(before.length).toBe(1)
          expect(before[0]).toStartWith(`${RULES[i]?.name}: ${file}:1:`)
          yield* fs.writeFileString(`${dir}/${file}`, `// ${line}\n`)
          expect(yield* scan(dir)).toEqual([])
        }),
      ),
    )

  test(
    'the repo has no hits',
    eff(Effect.map(scan(ROOT), (hits) => expect(hits).toEqual([]))),
    30_000,
  )
})
