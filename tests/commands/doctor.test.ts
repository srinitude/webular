// DOCTOR contract — real local toolchain checks; the network probe targets a
// local fixture so the diagnosis is provable offline.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const runDoctor = (args: string[], env: Record<string, string | undefined> = { ...process.env }) =>
  runCli('src/commands/doctor.ts', args, { env })

interface Check {
  name: string
  ok: boolean
  detail: string
}

describe('webular doctor — environment diagnostics (real checks)', () => {
  test('doctor --json exits 0 and has a bun check with ok true', async () => {
    const { code, out } = await runDoctor(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.ok).toBe('boolean')
    expect(Array.isArray(data.checks)).toBe(true)
    const bunCheck = data.checks.find((c: Check) => c.name === 'bun')
    expect(bunCheck).toBeDefined()
    expect(bunCheck.ok).toBe(true)
  }, 30_000)

  test('doctor --json result includes a mise check', async () => {
    const { code, out } = await runDoctor(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    const miseCheck = data.checks.find((c: Check) => c.name === 'mise')
    expect(miseCheck).toBeDefined()
  }, 30_000)

  test('includes tolerated agent-browser and deepsec checks', async () => {
    const { code, out } = await runDoctor(['--json'])
    expect(code).toBe(0)
    const names = (JSON.parse(out).checks as Check[]).map((c) => c.name)
    expect(names).toContain('agent-browser')
    expect(names).toContain('deepsec')
  }, 30_000)

  test('network check honors WEBULAR_DOCTOR_URL (provable offline)', async () => {
    const { code, out } = await runDoctor(['--json'], {
      ...process.env,
      WEBULAR_DOCTOR_URL: `${fx.origin}/c`,
    })
    expect(code).toBe(0)
    const network = (JSON.parse(out).checks as Check[]).find((c) => c.name === 'network')
    expect(network?.ok).toBe(true)
    expect(network?.detail).toContain('200')
  }, 30_000)
})
