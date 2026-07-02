// The ONLY bridge from the CLI to executable logic: shell out to mise.
// The CLI never imports command/workflow code directly — every subcommand,
// flag and parameter is routed here as `mise run run:<command> -- <args>`.
// Fresh-env hardening: mise resolves from PATH or the bundled npm binary (the
// pinned `mise` dependency); tasks run at the PACKAGE ROOT because a global
// install is invoked from directories that have no webular task graph; our own
// shipped config is pre-trusted (installing the package implies trusting it);
// and the invocation directory is exported so user-relative paths resolve
// where the user is standing.
import { delimiter, dirname, join } from 'node:path'
import { errMsg, logErr } from '../core/output.ts'
import { PACKAGE_ROOT, resolveBin } from '../core/root.ts'

interface RunResult {
  exitCode: number
}

export function resolveMise(): string | null {
  return resolveBin('mise', join(PACKAGE_ROOT, 'node_modules/mise/bin/mise'))
}

function gatewayEnv(): Record<string, string | undefined> {
  const trusted = process.env.MISE_TRUSTED_CONFIG_PATHS
  return {
    ...process.env,
    MISE_TRUSTED_CONFIG_PATHS: trusted ? `${trusted}${delimiter}${PACKAGE_ROOT}` : PACKAGE_ROOT,
    // Configs above the package must not affect task runs (deterministic graph).
    MISE_CEILING_PATHS: dirname(PACKAGE_ROOT),
    WEBULAR_INVOKE_DIR: process.cwd(),
  }
}

export async function runTask(task: string, args: string[]): Promise<RunResult> {
  const mise = resolveMise()
  if (!mise) {
    logErr(
      'webular: mise not found — install it (https://mise.jdx.dev/getting-started.html) or reinstall webular, then re-run.',
    )
    return { exitCode: 127 }
  }
  try {
    const proc = Bun.spawn([mise, 'run', task, '--', ...args], {
      cwd: PACKAGE_ROOT,
      env: gatewayEnv(),
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
    })
    return { exitCode: await proc.exited }
  } catch (err) {
    logErr(`webular: failed to launch mise (${errMsg(err)})`)
    return { exitCode: 127 }
  }
}
