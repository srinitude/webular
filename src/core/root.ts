// Absolute package root: the nearest folder at or above this module that holds
// mise.toml. Walking up (instead of a fixed '../../') keeps it right from src/,
// from a dist/ bundle, and from a split chunk at any depth. Path functions only,
// so it holds on macOS, Linux, and Windows.
import { dirname, join, sep } from 'node:path'
import { Effect, Path } from 'effect'

export function findPackageRoot(start: string): string | null {
  for (let dir = start; ; dir = dirname(dir)) {
    // Bun.file(...).size is a synchronous stat: 0 when the file is missing.
    if (Bun.file(join(dir, 'mise.toml')).size > 0) return dir
    if (dirname(dir) === dir) return null
  }
}

// Keeps the trailing separator callers rely on (`${PACKAGE_ROOT}src/...`).
// Fallback: a standalone executable has no mise.toml above its embedded
// modules, so the folder that holds the executable stands in.
export const PACKAGE_ROOT = join(
  findPackageRoot(import.meta.dir) ?? findPackageRoot(dirname(process.execPath)) ?? process.cwd(),
  sep,
)

// PATH first, then the packaged binary — ONE resolution policy for every
// external tool (mise, deepsec, agent-browser), so diagnosis and runtime
// can never disagree about which binary is in play. The packaged lookup goes
// through Bun.which too, so Windows finds the `.exe`/`.cmd` shim (PATHEXT)
// that package managers write instead of an extensionless file.
export function resolveBin(
  name: string,
  bundled?: string,
): Effect.Effect<string | null, never, Path.Path> {
  return Effect.map(Path.Path, (path) => {
    const local = bundled ?? path.join(PACKAGE_ROOT, 'node_modules/.bin', name)
    return Bun.which(name) ?? Bun.which(path.basename(local), { PATH: path.dirname(local) })
  })
}
