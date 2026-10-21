// Opt-in path confinement for untrusted-automation embedders. Enabled with
// WEBULAR_SANDBOX=1; otherwise paths pass through unchanged (default CLI UX).
// Confines to WEBULAR_OUTPUT_DIR (cwd by default) using realpath canonicalization
// so a symlinked parent directory cannot escape the sandbox.
import { Data, Effect, FileSystem, Path } from 'effect'

export class SandboxError extends Data.TaggedError('SandboxError')<{ readonly message: string }> {}

export function sandboxEnabled(): Effect.Effect<boolean> {
  return Effect.sync(() => process.env['WEBULAR_SANDBOX'] === '1')
}

// The directory the user invoked webular from — the gateway pins the command
// process cwd to the package root and exports the real one.
function invokeDir(): string {
  return process.env['WEBULAR_INVOKE_DIR'] ?? process.cwd()
}

// Canonical realpath of the deepest existing ancestor (the target may not exist
// yet) — resolves symlinks in every parent component, defeating symlink escapes.
const realAncestor = Effect.fn('safepath.realAncestor')(function* (full: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  let dir = full
  while (!(yield* fs.exists(dir))) dir = path.resolve(dir, '..')
  return yield* fs.realPath(dir)
})

const deny = (message: string) => Effect.fail(new SandboxError({ message }))

const confine = Effect.fn('safepath.confine')(function* (p: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (path.isAbsolute(p)) return yield* deny(`sandbox: absolute paths are not allowed (${p})`)
  const resolved = yield* Effect.gen(function* () {
    const base = yield* fs.realPath(path.resolve(process.env['WEBULAR_OUTPUT_DIR'] ?? invokeDir()))
    const full = path.resolve(base, p)
    return { base, full, escapes: path.relative(base, yield* realAncestor(full)).startsWith('..') }
  }).pipe(Effect.mapError((err) => new SandboxError({ message: `sandbox: ${err.message}` })))
  if (resolved.escapes) return yield* deny(`sandbox: path escapes ${resolved.base} (${p})`)
  return resolved.full
})

// Inputs are READ — resolve against the invoking directory but never confine
// them: the sandbox is write-confinement, not read-access control.
export function inPath(p: string): Effect.Effect<string, never, Path.Path> {
  return Effect.map(Path.Path, (path) => (path.isAbsolute(p) ? p : path.resolve(invokeDir(), p)))
}

// Resolve a user-supplied WRITE path against the invoking directory — the
// gateway runs command processes at the package root, so a bare relative path
// would otherwise land inside the installed package.
export function outPath(
  p: string,
): Effect.Effect<string, SandboxError, FileSystem.FileSystem | Path.Path> {
  return Effect.flatMap(sandboxEnabled(), (on) => (on ? confine(p) : inPath(p)))
}
