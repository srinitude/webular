// Release step: the npm dist-tag for one publish. A prerelease goes to `next`;
// a stable version below the current `latest` (a backport to an older line)
// goes to `maintenance`, so it never pulls `latest` backwards.
// Usage: bun src/release/dist-tag.ts <version> [current latest]
import { Console, Effect } from 'effect'

export const distTag = (version: string, latest: string): string => {
  if (version.includes('-')) return 'next'
  return latest !== '' && Bun.semver.order(version, latest) < 0 ? 'maintenance' : 'latest'
}

if (import.meta.main) {
  Effect.runSync(Console.log(distTag(Bun.argv[2] ?? '', Bun.argv[3] ?? '')))
}
