// Quality gate: no exported symbol in src/ without an importer — dead exports
// are how dead code accumulates (biome has no unused-exports rule).
import { describe, expect, test } from 'bun:test'
import { findDeadExports } from '../_support/exports.ts'
import { ROOT as REPO_ROOT } from '../_support/root.ts'

const ALLOW = new Set<string>([])

describe('dead exports — every src export has an importer', () => {
  test('no exported symbol in src/ is import-orphaned', () => {
    const dead = findDeadExports(REPO_ROOT.replace(/\/$/, ''), ALLOW)
    if (dead.length > 0) {
      console.error(dead.map((d) => `${d.file}: ${d.name}`).join('\n'))
    }
    expect(dead).toEqual([])
  })
})
