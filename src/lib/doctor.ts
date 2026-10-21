// DOCTOR lib — environment + toolchain checks over runProc (drained, timed).
// Required: bun, mise, node. Tolerated (reported, never failing overall ok):
// network, agent-browser, deepsec. WEBULAR_DOCTOR_URL overrides the probe
// target so the diagnosis is provable offline.
import { Config, Effect } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
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

function versionCheck(
  name: string,
  bin: string | null,
): Effect.Effect<Check, never, ChildProcessSpawner.ChildProcessSpawner> {
  if (!bin) return Effect.succeed({ name, ok: false, detail: 'not found (PATH or bundled)' })
  return runProc([bin, '--version'], { timeoutMs: 5_000 }).pipe(
    Effect.map(({ code, stdout, stderr }): Check => {
      if (code !== 0) return { name, ok: false, detail: stderr.trim() || `exit ${code}` }
      return { name, ok: true, detail: stdout.trim().split('\n')[0] ?? '' }
    }),
    Effect.catch((e) => Effect.succeed({ name, ok: false, detail: String(e) })),
  )
}

const doctorUrl = Config.String('WEBULAR_DOCTOR_URL').pipe(
  Config.withDefault('https://example.com'),
)

function checkNetwork(): Effect.Effect<Check> {
  return Effect.gen(function* () {
    const res = yield* httpGet(yield* doctorUrl, { timeoutMs: 10_000 })
    return { name: 'network', ok: res.ok, detail: `HTTP ${res.status}` }
  }).pipe(Effect.catch((e) => Effect.succeed({ name: 'network', ok: false, detail: String(e) })))
}

export const runChecks = Effect.fn('runChecks')(function* () {
  const probes = [
    versionCheck('bun', Bun.which('bun')),
    versionCheck('mise', yield* resolveMise()),
    versionCheck('node', Bun.which('node')),
    checkNetwork(),
    versionCheck('agent-browser', yield* resolveBin('agent-browser')),
    versionCheck('deepsec', yield* resolveBin('deepsec')),
  ]
  const checks = yield* Effect.all(probes, { concurrency: probes.length })
  const ok = checks.filter((c) => !TOLERATED.has(c.name)).every((c) => c.ok)
  return { ok, checks }
})
