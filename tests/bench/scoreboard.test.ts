// Contract: bench/scoreboard.json and the docs/scoreboard.md block match what
// scripts/bench/scoreboard.ts builds, every command has rows, every measured row
// names an eval file that exists, and every row without a value says "gap".
// Fix a drift failure with `mise run bench:scoreboard`.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Effect, FileSystem } from 'effect'
import { render } from '../../scripts/bench/scoreboard.ts'
import { COMMAND_LIST } from '../../scripts/bench/scoreboard-rows.ts'
import { eff } from '../_support/run.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))
const same = <A>(got: A, want: A) => expect(got).toEqual(want)

test(
  'scoreboard files match the generator (fix: mise run bench:scoreboard)',
  eff(
    Effect.map(render(root), ({ files }) =>
      same(
        files.map((f) => ({ path: f.path, text: f.current })),
        files.map((f) => ({ path: f.path, text: f.next })),
      ),
    ),
  ),
)

test(
  'every command has rows; measured rows name a real eval; the rest are gaps',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const { rows } = yield* render(root)
      same([...new Set(rows.map((r) => r.command))], COMMAND_LIST)
      for (const r of rows) {
        const row = `${r.command} ${r.metric}`
        const gap = r.status === 'gap'
        const ok = gap ? r.value === null && r.eval === null : r.value !== null
        const found = r.eval ? yield* fs.exists(`${root}${r.eval}`) : gap
        same({ row, ok, found }, { row, ok: true, found: true })
      }
    }),
  ),
)
