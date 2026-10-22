// Guard: every tracked Markdown file in the repo links each repo path it names, and every
// relative link, heading anchor, and line anchor resolves (plugins/webular/scripts/check-links.ts).

import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

test(
  'repo Markdown links every path it names and every link resolves',
  eff(
    Effect.gen(function* () {
      const out = yield* runProc(['bun', 'plugins/webular/scripts/check-links.ts', '--repo'], {
        timeoutMs: 60_000,
        cwd: ROOT,
      })
      expect(out.stderr).toBe('')
      expect(out.code).toBe(0)
    }),
  ),
  // Matches the child's own 60 s timeoutMs above; bun's 5 s default cut it short.
  60_000,
)
