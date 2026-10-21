// Release step (after the SHA256SUMS step): writes the Arch (PKGBUILD,
// .SRCINFO) and Nix (webular.nix) packaging files into dist/packaging from
// dist/bin/SHA256SUMS. The Dockerfile at the repo root is static and not
// written here. Publishing each one stays a manual step.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { PACKAGE_ROOT } from '../core/root.ts'
import { pkgbuild, srcinfo } from './aur.ts'
import { parseSums } from './distribution.ts'
import { nixDerivation } from './nix.ts'

const Version = Schema.fromJsonString(Schema.Struct({ version: Schema.String }))

// [file name, text] for each packaging file.
export const distroFiles = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.all([pkgbuild(version, sums), srcinfo(version, sums), nixDerivation(version, sums)], {
    concurrency: 3,
  }).pipe(
    Effect.map(
      ([aur, info, nix]) =>
        [
          ['PKGBUILD', aur],
          ['.SRCINFO', info],
          ['webular.nix', nix],
        ] as const,
    ),
  )

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const out = join(PACKAGE_ROOT, 'dist', 'packaging')
  const pkg = yield* fs.readFileString(join(PACKAGE_ROOT, 'package.json'))
  const { version } = yield* Schema.decodeUnknownEffect(Version)(pkg)
  const sums = parseSums(yield* fs.readFileString(join(PACKAGE_ROOT, 'dist', 'bin', 'SHA256SUMS')))
  const files = yield* distroFiles(version, sums)
  yield* fs.makeDirectory(out, { recursive: true })
  yield* Effect.forEach(files, ([name, text]) => fs.writeFileString(join(out, name), text), {
    concurrency: 3,
    discard: true,
  })
})

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
