// The lag check behind `mise run nix:check`: a webular.nix that pins a version
// other than the tag of the release at `releases/latest` is flagged; one that
// pins that tag (with or without the leading v) is not; one that pins nothing
// is flagged.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { assetName, TARGETS } from '../../src/core/platform.ts'
import { parseSums } from '../../src/release/distribution.ts'
import { nixDerivation } from '../../src/release/nix.ts'
import { nixLags, nixVersion } from '../../src/release/nix-refresh.ts'

const sums = parseSums(TARGETS.map((x) => `${'a'.repeat(64)}  ${assetName(x)}`).join('\n'))
const nixFor = (version: string) => Effect.runSync(nixDerivation(version, sums))

test('a webular.nix behind the published tag is flagged', () => {
  const stale = nixFor('0.3.2')
  expect(nixVersion(stale)).toBe('0.3.2')
  expect(nixLags(stale, 'v0.3.3')).toBe(true)
})

test('a webular.nix at the published tag is not flagged', () => {
  const current = nixFor('0.3.3')
  expect(nixLags(current, 'v0.3.3')).toBe(false)
  expect(nixLags(current, '0.3.3')).toBe(false)
})

test('a webular.nix that names no version is flagged', () => {
  expect(nixVersion('{ }')).toBe('')
  expect(nixLags('{ }', 'v0.3.3')).toBe(true)
})
