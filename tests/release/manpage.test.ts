// manpage output: the page lints clean under mandoc (STYLE notes allowed),
// renders, and names every command, global option, and roff specials safely.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { manpage, writeManpage } from '../../src/release/manpage.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

// Found on PATH: macOS ships it in /usr/bin, Linux CI installs it with apt.
const MANDOC = 'mandoc'
// dist/ is gitignored, so the page never reaches a commit.
const DIR = join(ROOT, 'dist', 'man-test')

const mandoc = (args: string[]) => Effect.sync(() => Bun.spawnSync([MANDOC, ...args]))

test(
  'webular.1 lints without warnings or errors and renders every command',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const file = yield* writeManpage(DIR)
      const lint = yield* mandoc(['-T', 'lint', '-W', 'warning', file])
      const bad = lint.stderr
        .toString()
        .split('\n')
        .filter((line) => line !== '' && !line.includes(': STYLE:'))
      const text = (yield* mandoc(['-T', 'utf8', file])).stdout
        .toString()
        .replace(new RegExp(`.${String.fromCharCode(8)}`, 'g'), '')
      yield* fs.remove(DIR, { recursive: true, force: true })
      expect(bad).toEqual([])
      for (const name of COMMAND_NAMES) expect(text).toContain(name)
      expect(text).toContain('--json')
      expect(text).toContain('https://github.com/srinitude/webular')
    }),
  ),
)

test('roff specials are escaped', () => {
  const page = manpage({
    version: '1.2.3',
    homepage: 'https://example.com',
    date: 'October 21, 2026',
    globals: [['--x', '.dot \\back']],
    flags: {},
  })
  expect(page).toContain('\\&.dot \\eback')
})
