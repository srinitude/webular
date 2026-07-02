// DOCTOR lib — environment + toolchain checks over runProc (drained, timed).
// Required: bun, mise, node. Tolerated (reported, never failing overall ok):
// network, agent-browser, deepsec. WEBULAR_DOCTOR_URL overrides the probe
// target so the diagnosis is provable offline.
import { httpGet } from '../core/http.ts'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'
import { resolveMise } from '../mise/gateway.ts'

interface Check {
  name: string
  ok: boolean
  detail: string
}

const TOLERATED = new Set(['network', 'agent-browser', 'deepsec'])

async function versionCheck(name: string, bin: string | null): Promise<Check> {
  if (!bin) return { name, ok: false, detail: 'not found (PATH or bundled)' }
  try {
    const { code, stdout, stderr } = await runProc([bin, '--version'], { timeoutMs: 5_000 })
    if (code !== 0) return { name, ok: false, detail: stderr.trim() || `exit ${code}` }
    return { name, ok: true, detail: stdout.trim().split('\n')[0] ?? '' }
  } catch (e) {
    return { name, ok: false, detail: String(e) }
  }
}

async function checkNetwork(): Promise<Check> {
  const target = process.env.WEBULAR_DOCTOR_URL ?? 'https://example.com'
  try {
    const res = await httpGet(target, { timeoutMs: 10_000 })
    return { name: 'network', ok: res.ok, detail: `HTTP ${res.status}` }
  } catch (e) {
    return { name: 'network', ok: false, detail: String(e) }
  }
}

interface DoctorResult {
  ok: boolean
  checks: Check[]
}

export async function runChecks(): Promise<DoctorResult> {
  const checks = await Promise.all([
    versionCheck('bun', Bun.which('bun')),
    versionCheck('mise', resolveMise()),
    versionCheck('node', Bun.which('node')),
    checkNetwork(),
    versionCheck('agent-browser', resolveBin('agent-browser')),
    versionCheck('deepsec', resolveBin('deepsec')),
  ])
  const ok = checks.filter((c) => !TOLERATED.has(c.name)).every((c) => c.ok)
  return { ok, checks }
}
