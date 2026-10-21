// mise lookup for the commands that use mise itself: doctor reports its
// version and tasks lists the graph. Commands start without mise; see
// src/cli/dispatch.ts.
import { join } from 'node:path'
import type { Effect, Path } from 'effect'
import { PACKAGE_ROOT, resolveBin } from '../core/root.ts'

export function resolveMise(): Effect.Effect<string | null, never, Path.Path> {
  return resolveBin('mise', join(PACKAGE_ROOT, 'node_modules/mise/bin/mise'))
}
