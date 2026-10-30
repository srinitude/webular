// DOCTOR lib — environment + toolchain checks over runProc (drained, timed).
// Required: bun, mise, node. Tolerated (reported, never failing overall ok):
// network, agent-browser, deepsec, and jev (the active route). WEBULAR_DOCTOR_URL
// overrides the probe target so the diagnosis is provable offline.
import { Config, Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import type { ChildProcessSpawner } from 'effect/process'
import { httpGet } from '../core/http.ts'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'
import { resolveMise } from '../mise/gateway.ts'
import { upgradeFor } from '../release/upgrade.ts'
import { checkJevRoute } from './jev/doctor-route.ts'

interface Check {
  name: string
  ok: boolean
  detail: string
}

const TOLERATED = new Set(['network', 'agent-browser', 'deepsec', 'jev'])

// A cold first start (empty HOME, 8 probes at once) measured 4.3 s for deepsec,
// so 5 s was too tight; 20 s keeps the margin without hanging a real fault.
const VERSION_TIMEOUT_MS = 20_000

export function versionCheck(
  name: string,
  bin: string | null,
  timeoutMs = VERSION_TIMEOUT_MS,
): Effect.Effect<Check, never, ChildProcessSpawner.ChildProcessSpawner> {
  if (!bin) return Effect.succeed({ name, ok: false, detail: 'not found (PATH or bundled)' })
  return runProc([bin, '--version'], { timeoutMs }).pipe(
    Effect.map(({ code, stdout, stderr, timedOut }): Check => {
      // runProc reports a timeout kill as code 143; name it, never print the bare code.
      if (timedOut) {
        return {
          name,
          ok: false,
          detail: `timed out after ${timeoutMs / 1000}s (slow first start)`,
        }
      }
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
    yield* Effect.promise(() => res.body?.cancel() ?? Promise.resolve())
    return { name: 'network', ok: res.ok, detail: `HTTP ${res.status}` }
  }).pipe(Effect.catch((e) => Effect.succeed({ name: 'network', ok: false, detail: String(e) })))
}

// How to upgrade the running install; informational, so it always passes.
const checkUpgrade = Effect.gen(function* () {
  const install = yield* Config.String('WEBULAR_INSTALL').pipe(Config.withDefault(''))
  const paths = [process.execPath, process.argv[1] ?? '']
  const { command } = upgradeFor(paths, { WEBULAR_INSTALL: install })
  return { name: 'upgrade', ok: true, detail: command }
}).pipe(Effect.orDie)

export const runChecks = Effect.fn('runChecks')(function* () {
  const probes = [
    versionCheck('bun', Bun.which('bun')),
    versionCheck('mise', yield* resolveMise()),
    versionCheck('node', Bun.which('node')),
    checkNetwork(),
    checkUpgrade,
    versionCheck('agent-browser', yield* resolveBin('agent-browser')),
    versionCheck('deepsec', yield* resolveBin('deepsec')),
    checkJevRoute.pipe(Effect.provide(FetchHttpClient.layer)),
  ]
  const checks = yield* Effect.all(probes, { concurrency: probes.length })
  const ok = checks.filter((c) => !TOLERATED.has(c.name)).every((c) => c.ok)
  return { ok, checks }
})
