// DOCTOR lib — runs environment + toolchain checks using Bun.spawn and httpGet.
import { httpGet } from '../core/http.ts'

export interface Check {
  name: string
  ok: boolean
  detail: string
}

async function spawnVersion(cmd: string, args: string[]): Promise<Check> {
  try {
    const proc = Bun.spawn([cmd, ...args], { stdout: 'pipe', stderr: 'pipe' })
    const out = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) {
      const err = await new Response(proc.stderr).text()
      return { name: cmd, ok: false, detail: err.trim() || `exit ${code}` }
    }
    return { name: cmd, ok: true, detail: out.trim() }
  } catch (e) {
    return { name: cmd, ok: false, detail: String(e) }
  }
}

async function checkNetwork(): Promise<Check> {
  try {
    const res = await httpGet('https://example.com', { timeoutMs: 10_000 })
    return { name: 'network', ok: res.ok, detail: `HTTP ${res.status}` }
  } catch (e) {
    return { name: 'network', ok: false, detail: String(e) }
  }
}

export interface DoctorResult {
  ok: boolean
  checks: Check[]
}

export async function runChecks(): Promise<DoctorResult> {
  const [bun, mise, node, network] = await Promise.all([
    spawnVersion('bun', ['--version']),
    spawnVersion('mise', ['--version']),
    spawnVersion('node', ['--version']),
    checkNetwork(),
  ])
  const checks: Check[] = [
    { ...bun, name: 'bun' },
    { ...mise, name: 'mise' },
    { ...node, name: 'node' },
    network,
  ]
  // network failure is tolerated — does not fail overall ok
  const requiredChecks = checks.filter((c) => c.name !== 'network')
  const ok = requiredChecks.every((c) => c.ok)
  return { ok, checks }
}
