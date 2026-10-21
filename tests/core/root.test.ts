import { expect, test } from 'bun:test'
import { join, parse, sep } from 'node:path'
import { Effect } from 'effect'
import { findPackageRoot, PACKAGE_ROOT, packageRoot } from '../../src/core/root.ts'

const repo = join(import.meta.dir, '..', '..')

test('PACKAGE_ROOT is the folder holding mise.toml when run from src', () => {
  expect(PACKAGE_ROOT).toBe(join(repo, sep))
})

test('findPackageRoot walks up from any depth, as bundles and split chunks need', () => {
  expect(findPackageRoot(join(repo, 'dist', 'commands'))).toBe(repo)
  expect(findPackageRoot(join(repo, 'dist', 'commands', 'chunks', 'deep'))).toBe(repo)
})

test('findPackageRoot returns null when no mise.toml is above', () => {
  expect(findPackageRoot(join(parse(repo).root, 'no-such-webular-dir'))).toBeNull()
})

test('packageRoot finds the repo from the source module', () =>
  Effect.runPromise(Effect.map(packageRoot, (root) => expect(root).toBe(repo))))
