// The generated Homebrew formula and Scoop manifest are valid on their own:
// `ruby -c` accepts the formula (a structural parse stands in when ruby is
// missing) and the manifest is JSON with the Scoop schema's fields.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem, Schema } from 'effect'
import { assetName, TARGETS } from '../../src/core/platform.ts'
import { runProc } from '../../src/core/proc.ts'
import {
  brewTargets,
  homebrewFormula,
  releaseUrl,
  scoopManifest,
} from '../../src/release/distribution.ts'
import { eff, tmpDir } from '../_support/run.ts'

const VERSION = '0.0.0-test'
const shaOf = (asset: string) =>
  new Bun.CryptoHasher('sha256').update(asset).digest('hex') as string
const sums = new Map(TARGETS.map((x) => [assetName(x), shaOf(assetName(x))] as const))

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0

// Stands in for `ruby -c`: block balance, then every field the formula needs.
const structural = (rb: string) => {
  const opens = count(rb, /^\s*(class|def)\s/gm) + count(rb, /\bdo$/gm)
  expect(count(rb, /^\s*end$/gm)).toBe(opens)
  for (const re of [/^class Webular < Formula$/m, /^ {2}desc ".+"$/m, /^ {2}homepage "https:/m])
    expect(rb).toMatch(re)
  for (const re of [/^ {2}version ".+"$/m, /^ {2}license ".+"$/m, /^ {2}def install$/m])
    expect(rb).toMatch(re)
  expect(rb).toMatch(/^ {2}test do$/m)
  for (const t of brewTargets) {
    const asset = assetName(t)
    expect(rb).toContain(`url "${releaseUrl(VERSION, asset)}"`)
    expect(rb).toContain(`sha256 "${shaOf(asset)}"`)
  }
}

test(
  'homebrew formula passes ruby -c (or the structural parse without ruby)',
  eff(
    Effect.gen(function* () {
      const rb = yield* homebrewFormula(VERSION, sums)
      structural(rb)
      const ruby = Bun.which('ruby')
      if (!ruby) return
      const fs = yield* FileSystem.FileSystem
      const file = join(yield* tmpDir('webular-brew-'), 'webular.rb')
      yield* fs.writeFileString(file, rb)
      const out = yield* runProc([ruby, '-c', file], { timeoutMs: 20_000 })
      expect(out.stdout).toContain('Syntax OK')
      expect(out.code).toBe(0)
    }),
  ),
)

const Entry = Schema.Struct({ url: Schema.String, hash: Schema.String })
const Scoop = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.String,
    description: Schema.String,
    homepage: Schema.String,
    license: Schema.String,
    bin: Schema.String,
    architecture: Schema.Struct({ '64bit': Entry, arm64: Entry }),
  }),
)

test(
  'scoop manifest is JSON with the Scoop schema fields',
  eff(
    Effect.gen(function* () {
      const m = yield* Schema.decodeUnknownEffect(Scoop)(yield* scoopManifest(VERSION, sums))
      expect([m.version, m.bin]).toEqual([VERSION, 'webular.exe'])
      for (const e of Object.values(m.architecture)) {
        expect(e.url).toMatch(/#\/webular\.exe$/)
        expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
      }
    }),
  ),
)
