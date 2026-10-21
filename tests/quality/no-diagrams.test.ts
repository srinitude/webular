// Guard: docs/diagrams and Mermaid diagrams are gone for good. The XState
// machines in src/machines/ replace them; this fails if any diagram returns.

import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { ROOT } from '../_support/root.ts'

const files = Bun.spawnSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: ROOT,
})
  .stdout.toString()
  .split('\n')

describe('no diagram docs come back', () => {
  test('docs/diagrams does not exist', () => {
    expect(existsSync(`${ROOT}docs/diagrams`)).toBe(false)
  })

  test('no Mermaid source anywhere in the repo', () => {
    expect(files.filter((f) => /\.(mmd|mermaid)$/.test(f))).toEqual([])
  })

  test('no SVG under docs/', () => {
    expect(files.filter((f) => f.startsWith('docs/') && f.endsWith('.svg'))).toEqual([])
  })
})
