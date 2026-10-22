// batch takes only web URLs: file:, data:, and javascript: never reach a fetch (SSRF and
// local file reads), as the single-url commands already check.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

test(
  'batch rejects file: and javascript: URLs',
  eff(
    Effect.gen(function* () {
      const bad = 'file:///etc/hosts,javascript:void(0)'
      const { code, out } = yield* runCli('src/commands/batch.ts', ['--urls', bad, '--json'])
      expect(code).not.toBe(0)
      expect(out).not.toContain('"ok"')
    }),
  ),
  60_000,
)
