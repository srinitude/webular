// After each publish: `mise run nix:refresh [version]` rewrites the repo-root
// webular.nix from that published release's SHA256SUMS (default: the release
// at `releases/latest`), through the same generator the release path uses.
// `mise run nix:check` fails when webular.nix pins a version other than the
// tag of the release at `releases/latest`. The tag is the source, not
// package.json: a version's checksums exist only once its release is published.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Data, Effect, FileSystem } from 'effect'
import { runProc } from '../core/proc.ts'
import { PACKAGE_ROOT } from '../core/root.ts'
import { parseSums } from './distribution.ts'
import { nixDerivation } from './nix.ts'

const REPO = 'srinitude/webular'
const FILE = join(PACKAGE_ROOT, 'webular.nix')

class NixRefreshError extends Data.TaggedError('NixRefreshError')<{ readonly message: string }> {}

// The version a webular.nix pins, or '' when it names none.
export const nixVersion = (text: string): string => /version = "([^"]+)";/.exec(text)?.[1] ?? ''

// True when webular.nix pins anything other than the published tag it is checked against.
export const nixLags = (text: string, publishedTag: string): boolean =>
  nixVersion(text) !== publishedTag.replace(/^v/, '')

// gh uses the login already on the machine; it adds no token.
const gh = Effect.fn('gh')(function* (args: string[]) {
  const r = yield* runProc(['gh', ...args, '--repo', REPO], { timeoutMs: 60_000 })
  if (r.code !== 0)
    return yield* new NixRefreshError({ message: `gh ${args.join(' ')}: ${r.stderr.trim()}` })
  return r.stdout
})

// `gh release view` with no tag reads `releases/latest` (published, not draft, not prerelease).
const publishedTag = Effect.map(
  gh(['release', 'view', '--json', 'tagName', '-q', '.tagName']),
  (s) => s.trim(),
)

const refresh = Effect.fn('nixRefresh')(function* (version: string | undefined) {
  const tag = version ? `v${version.replace(/^v/, '')}` : yield* publishedTag
  const sums = parseSums(
    yield* gh(['release', 'download', tag, '--pattern', 'SHA256SUMS', '--output', '-']),
  )
  const fs = yield* FileSystem.FileSystem
  yield* fs.writeFileString(FILE, yield* nixDerivation(tag.slice(1), sums))
  yield* Console.log(`webular.nix: ${tag}`)
})

const check = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const text = yield* fs.readFileString(FILE)
  const tag = yield* publishedTag
  if (nixLags(text, tag))
    return yield* Effect.fail(
      new NixRefreshError({
        message: `webular.nix pins ${nixVersion(text) || 'no version'}, the published release is ${tag}: run mise run nix:refresh`,
      }),
    )
  yield* Console.log(`webular.nix matches ${tag}`)
})

if (import.meta.main) {
  const [mode, version] = process.argv.slice(2)
  BunRuntime.runMain(
    (mode === 'check' ? check : refresh(version)).pipe(Effect.provide(BunServices.layer)),
  )
}
