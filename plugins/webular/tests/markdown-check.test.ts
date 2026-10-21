// Outcome evals for the Markdown checker: clean pass, broken link, bad anchor, line limits, reading cycle.
import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { checkMarkdown, type Manifest } from '../skills/rich-and-native-markdown/scripts/check.ts'

type Outcome = Effect.Success<ReturnType<typeof checkMarkdown>>

// Writes the files into a scoped TMPDIR folder (removed on exit), then checks the picked ones.
const run = (
  files: Record<string, string>,
  pick: string[],
  manifest?: (at: (n: string) => string) => Manifest,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* fs.makeTempDirectoryScoped({ directory: tmpdir(), prefix: 'md-check-' })
      for (const [name, text] of Object.entries(files))
        yield* fs.writeFileString(`${dir}/${name}`, text)
      const at = (n: string) => `${dir}/${n}`
      return yield* checkMarkdown(pick.map(at), manifest?.(at))
    }),
  ).pipe(Effect.provide(BunServices.layer))

const verify =
  (check: (r: Outcome) => void) =>
  <E, R>(self: Effect.Effect<Outcome, E, R>) =>
    Effect.flatMap(self, (r) => Effect.sync(() => check(r)))

const clean =
  '# Title\n\n## Part One\n\nSee [other](b.md#part-one) and [self](#part-one).\n\n```md\n[ignored](nope.md)\n```\n'

test('a clean file passes, and links inside fences are skipped', () =>
  Effect.runPromise(
    run({ 'a.md': clean, 'b.md': '# B\n\n## Part One\n\ntext\n' }, ['a.md']).pipe(
      verify((r) => {
        expect(r.errors).toEqual([])
        expect(r.files.map((f) => f.lines)).toEqual([9])
      }),
    ),
  ))

test('a broken link and a bad anchor are errors', () =>
  Effect.runPromise(
    run({ 'a.md': '# A\n\n[x](gone.md) [y](b.md#nope)\n', 'b.md': '# B\n' }, ['a.md']).pipe(
      verify((r) => {
        expect(r.errors.some((e) => e.includes('missing local target gone.md'))).toBe(true)
        expect(r.errors.some((e) => e.includes('missing heading or HTML anchor b.md#nope'))).toBe(
          true,
        )
      }),
    ),
  ))

test('200 lines fail and 150 lines need review', () => {
  const lines = (n: number) => `# Long\n${'x\n'.repeat(n - 1)}`
  return Effect.runPromise(
    run({ 'long.md': lines(200), 'mid.md': lines(150) }, ['long.md', 'mid.md']).pipe(
      verify((r) => {
        expect(r.errors.filter((e) => e.includes('maximum is 199'))).toHaveLength(1)
        expect(r.needs_review.filter((e) => e.includes('150 lines'))).toHaveLength(1)
      }),
    ),
  )
})

test('a required cycle and an unreachable file are errors', () =>
  Effect.runPromise(
    run({ 'a.md': '# A\n', 'b.md': '# B\n', 'c.md': '# C\n' }, ['a.md', 'b.md', 'c.md'], (at) => ({
      entrypoints: [at('a.md')],
      dependencies: [
        { from: at('a.md'), to: at('b.md'), kind: 'required' },
        { from: at('b.md'), to: at('a.md'), kind: 'required' },
      ],
    })).pipe(
      verify((r) => {
        expect(r.errors.some((e) => e.startsWith('Required-read cycle'))).toBe(true)
        expect(r.errors.some((e) => e.includes('unreachable') && e.endsWith('c.md'))).toBe(true)
      }),
    ),
  ))
