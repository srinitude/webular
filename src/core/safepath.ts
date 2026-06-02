// Opt-in path confinement for untrusted-automation embedders. Enabled with
// WEBULAR_SANDBOX=1; otherwise paths pass through unchanged (default CLI UX).
// When enabled, output/input paths must stay inside WEBULAR_OUTPUT_DIR (cwd by
// default): no absolute paths, no `..` escape, no symlink targets.
import { existsSync, lstatSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export function sandboxEnabled(): boolean {
  return process.env.WEBULAR_SANDBOX === '1'
}

function baseDir(): string {
  return resolve(process.env.WEBULAR_OUTPUT_DIR ?? process.cwd())
}

export function safePath(p: string): string {
  if (!sandboxEnabled()) return p
  if (isAbsolute(p)) throw new Error(`sandbox: absolute paths are not allowed (${p})`)
  const base = baseDir()
  const full = resolve(base, p)
  if (relative(base, full).startsWith('..')) throw new Error(`sandbox: path escapes ${base} (${p})`)
  if (existsSync(full) && lstatSync(full).isSymbolicLink()) {
    throw new Error(`sandbox: refusing symlink target (${p})`)
  }
  return full
}
