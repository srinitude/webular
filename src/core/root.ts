// Absolute package root, decoded via fileURLToPath — URL.pathname percent-encodes
// special characters (spaces, braces), which breaks installs at such paths.
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url))

// PATH first, then the packaged binary — ONE resolution policy for every
// external tool (mise, deepsec, agent-browser), so diagnosis and runtime
// can never disagree about which binary is in play. The packaged lookup goes
// through Bun.which too, so Windows finds the `.exe`/`.cmd` shim (PATHEXT)
// that package managers write instead of an extensionless file.
export function resolveBin(name: string, bundled?: string): string | null {
  const local = bundled ?? join(PACKAGE_ROOT, 'node_modules/.bin', name)
  return Bun.which(name) ?? Bun.which(basename(local), { PATH: dirname(local) })
}
