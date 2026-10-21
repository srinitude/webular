// JEV contract — `webular jev correct` labels a recorded call as an eval case and
// `webular jev learn` summarizes the call log, against a private state folder
// (real process, no mocks). Tests what `mise run run:jev` executes.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff, tmpDir } from '../_support/run.ts'

const row = {
  id: 'call-42',
  at: '2026-10-21T00:00:00.000Z',
  decision: 'crawl.link',
  model: null,
  payloadHash: 'abc123',
  questionKinds: { content: 'choice' },
  pick: { content: 'yes' },
  confidence: 0.9,
  latencyMs: 12,
  inputTokens: 0,
  codeCheck: null,
  fallback: false,
}

test(
  'jev correct records an eval case, jev learn reads the log, a bad subcommand is a usage error',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('webular-jev-')
      yield* fs.writeFileString(`${dir}/jev-calls.jsonl`, `${JSON.stringify(row)}\n`)
      const env = { WEBULAR_STATE_DIR: dir, WEBULAR_JEV: 'off' }
      const jev = (...args: string[]) =>
        runCli('src/commands/jev.ts', args, { env, exec: process.execPath })

      const fix = yield* jev('correct', 'call-42', 'yes')
      expect(fix.code).toBe(0)
      expect(fix.out).toContain('crawl.link')
      const cases = yield* fs.readFileString(`${dir}/jev-evals/crawl.link.jsonl`)
      expect(cases).toContain('"callId":"call-42"')
      expect(cases).toContain('"label":"yes"')

      expect((yield* jev('correct', 'nope', 'yes')).code).toBe(1)

      const learned = yield* jev('learn')
      expect(learned.code).toBe(0)
      expect(learned.out).toContain('"crawl.link"')
      expect(yield* fs.exists(`${dir}/jev-lessons.json`)).toBe(true)

      const bad = yield* jev('bogus')
      expect(bad.code).toBe(2)
      expect(bad.err).toContain('webular jev correct')
    }),
  ),
  60000,
)
