// Sandbox default: agent mode confines output paths unless WEBULAR_SANDBOX=0;
// a person at the CLI writes anywhere unless WEBULAR_SANDBOX=1.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { outPath } from '../../src/core/safepath.ts'
import { eff } from '../_support/run.ts'

const KEYS = ['WEBULAR_AGENT_MODE', 'WEBULAR_SANDBOX'] as const

// Runs outPath under the given env and reports whether the sandbox refused it.
const refused = (env: Partial<Record<(typeof KEYS)[number], string>>, p: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const saved = KEYS.map((k) => [k, process.env[k]] as const)
      for (const k of KEYS) delete process.env[k]
      Object.assign(process.env, env)
      return saved
    }),
    () =>
      outPath(p).pipe(
        Effect.as(false),
        Effect.catchTag('SandboxError', () => Effect.succeed(true)),
      ),
    (saved) =>
      Effect.sync(() => {
        for (const [k, v] of saved) {
          if (v === undefined) delete process.env[k]
          else process.env[k] = v
        }
      }),
  )

describe('output-path sandbox default', () => {
  test(
    'agent mode refuses an absolute path by default',
    eff(
      Effect.map(refused({ WEBULAR_AGENT_MODE: '1' }, '/tmp/webular-evil.md'), (r) =>
        expect(r).toBe(true),
      ),
    ),
  )
  test(
    'agent mode refuses a path that climbs out of the folder',
    eff(
      Effect.map(refused({ WEBULAR_AGENT_MODE: '1' }, '../webular-evil.md'), (r) =>
        expect(r).toBe(true),
      ),
    ),
  )
  test(
    'WEBULAR_SANDBOX=0 lifts the agent-mode sandbox',
    eff(
      Effect.map(refused({ WEBULAR_AGENT_MODE: '1', WEBULAR_SANDBOX: '0' }, '/tmp/x.md'), (r) =>
        expect(r).toBe(false),
      ),
    ),
  )
  test(
    'the CLI writes an absolute path by default',
    eff(Effect.map(refused({}, '/tmp/x.md'), (r) => expect(r).toBe(false))),
  )
})
