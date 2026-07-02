// Opt-in path confinement for untrusted-automation embedders. Enabled with
// WEBULAR_SANDBOX=1; otherwise paths pass through unchanged (default CLI UX).
// Confines to WEBULAR_OUTPUT_DIR (cwd by default) using realpath canonicalization
// so a symlinked parent directory cannot escape the sandbox.
import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export function sandboxEnabled(): boolean {
  return process.env.WEBULAR_SANDBOX === '1'
}

// The directory the user invoked webular from — the gateway pins the command
// process cwd to the package root and exports the real one.
function invokeDir(): string {
  return process.env.WEBULAR_INVOKE_DIR ?? process.cwd()
}

function baseDir(): string {
  return realpathSync(resolve(process.env.WEBULAR_OUTPUT_DIR ?? invokeDir()))
}

// Canonical realpath of the deepest existing ancestor (the target may not exist
// yet) — resolves symlinks in every parent component, defeating symlink escapes.
function realAncestor(full: string): string {
  let dir = full
  while (!existsSync(dir)) dir = resolve(dir, '..')
  return realpathSync(dir)
}

function safePath(p: string): string {
  if (!sandboxEnabled()) return p
  if (isAbsolute(p)) throw new Error(`sandbox: absolute paths are not allowed (${p})`)
  const base = baseDir()
  const full = resolve(base, p)
  if (relative(base, realAncestor(full)).startsWith('..')) {
    throw new Error(`sandbox: path escapes ${base} (${p})`)
  }
  return full
}

// Resolve a user-supplied WRITE path against the invoking directory — the
// gateway runs command processes at the package root, so a bare relative path
// would otherwise land inside the installed package.
export function outPath(p: string): string {
  if (sandboxEnabled()) return safePath(p)
  if (isAbsolute(p)) return p
  return resolve(invokeDir(), p)
}

// Inputs are READ — resolve against the invoking directory but never confine
// them: the sandbox is write-confinement, not read-access control.
export function inPath(p: string): string {
  if (isAbsolute(p)) return p
  return resolve(invokeDir(), p)
}
