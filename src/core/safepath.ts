// Opt-in path confinement for untrusted-automation embedders. Enabled with
// WEBULAR_SANDBOX=1; otherwise paths pass through unchanged (default CLI UX).
// Confines to WEBULAR_OUTPUT_DIR (cwd by default) using realpath canonicalization
// so a symlinked parent directory cannot escape the sandbox.
import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export function sandboxEnabled(): boolean {
  return process.env.WEBULAR_SANDBOX === '1'
}

function baseDir(): string {
  return realpathSync(resolve(process.env.WEBULAR_OUTPUT_DIR ?? process.cwd()))
}

// Canonical realpath of the deepest existing ancestor (the target may not exist
// yet) — resolves symlinks in every parent component, defeating symlink escapes.
function realAncestor(full: string): string {
  let dir = full
  while (!existsSync(dir)) dir = resolve(dir, '..')
  return realpathSync(dir)
}

export function safePath(p: string): string {
  if (!sandboxEnabled()) return p
  if (isAbsolute(p)) throw new Error(`sandbox: absolute paths are not allowed (${p})`)
  const base = baseDir()
  const full = resolve(base, p)
  if (relative(base, realAncestor(full)).startsWith('..')) {
    throw new Error(`sandbox: path escapes ${base} (${p})`)
  }
  return full
}
