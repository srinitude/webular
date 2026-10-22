// Contract: every benchmark number in the docs matches the committed peer run
// with the highest timestamp. Regenerates in memory and fails on any drift, and
// on any score, latency, or run name typed outside a generated block.
// Fix a failure with `mise run bench:docs`.

import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { fill, pickRun, render, strays } from '../../scripts/bench/peers/docs.ts'
import { eff } from '../_support/run.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))
const check = (each: (d: { path: string; current: string; next: string }) => void) =>
  eff(Effect.map(render(root), (ds) => ds.forEach(each)))

test(
  'every generated block matches the committed results (fix: mise run bench:docs)',
  check((d) => expect({ path: d.path, text: d.current }).toEqual({ path: d.path, text: d.next })),
)

test(
  'no benchmark number sits outside a generated block',
  check((d) =>
    expect({ path: d.path, strays: strays(d.current) }).toEqual({ path: d.path, strays: [] }),
  ),
)

test('the run is picked by its recorded timestamp, not by name order or mtime', () => {
  const names = [
    'peers-2026-10-21T03-51-21-982Z.json',
    'peers-2026-10-21T03-51-21-982Z.txt',
    'peers-2026-12-01T00-00-00-000Z.json',
    'peers-2026-11-30T23-59-59-999Z.json',
    'peers-zzzz.json',
  ]
  expect(pickRun(names)).toBe('peers-2026-12-01T00-00-00-000Z.json')
  expect(pickRun(['notes.json'])).toBeUndefined()
})

test('a stale number inside a block is rewritten, and unknown blocks are reported', () => {
  const fresh = '<!-- bench:start a -->\nscore 0.222\n<!-- bench:end -->'
  expect(fill(fresh.replace('0.222', '0.999'), { a: 'score 0.222' })).toEqual({
    text: fresh,
    unknown: [],
  })
  expect(fill(fresh, {}).unknown).toEqual(['a'])
  expect(strays(`${fresh}\nwebular scored 0.999 in 12 ms`)).toEqual([
    'webular scored 0.999 in 12 ms',
  ])
})
