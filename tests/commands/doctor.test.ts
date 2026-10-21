// DOCTOR contract — real local toolchain checks; the network probe targets a
// local fixture so the diagnosis is provable offline.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runDoctor = (args: string[], env: Record<string, string | undefined> = { ...process.env }) =>
  runCli('src/commands/doctor.ts', args, { env })

interface Check {
  name: string
  ok: boolean
  detail: string
}

describe('webular doctor — environment diagnostics (real checks)', () => {
  test(
    'doctor --json exits 0 and has a bun check with ok true',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDoctor(['--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(typeof data.ok).toBe('boolean')
        expect(Array.isArray(data.checks)).toBe(true)
        const bunCheck = data.checks.find((c: Check) => c.name === 'bun')
        expect(bunCheck).toBeDefined()
        expect(bunCheck.ok).toBe(true)
      }),
    ),
    30_000,
  )

  test(
    'doctor --json result includes a mise check',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDoctor(['--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        const miseCheck = data.checks.find((c: Check) => c.name === 'mise')
        expect(miseCheck).toBeDefined()
      }),
    ),
    30_000,
  )

  test(
    'includes tolerated agent-browser and deepsec checks',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDoctor(['--json'])
        expect(code).toBe(0)
        const names = (JSON.parse(out).checks as Check[]).map((c) => c.name)
        expect(names).toContain('agent-browser')
        expect(names).toContain('deepsec')
      }),
    ),
    30_000,
  )

  test(
    'network check honors WEBULAR_DOCTOR_URL (provable offline)',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDoctor(['--json'], {
          ...process.env,
          WEBULAR_DOCTOR_URL: `${fx.origin}/c`,
        })
        expect(code).toBe(0)
        const network = (JSON.parse(out).checks as Check[]).find((c) => c.name === 'network')
        expect(network?.ok).toBe(true)
        expect(network?.detail).toContain('200')
      }),
    ),
    30_000,
  )

  test(
    'exits 1 when a required check fails (no bun/node/mise on PATH)',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runCli('src/commands/doctor.ts', ['--json'], {
          env: { ...process.env, PATH: '/nonexistent' },
          exec: process.execPath,
        })
        expect(code).toBe(1)
        expect(JSON.parse(out).ok).toBe(false)
      }),
    ),
    30_000,
  )
})
