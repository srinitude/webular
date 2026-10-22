// Drift check: every file in tests/jev/evals is the eval file of exactly one
// registered decision (the other direction, decision -> file, is in define.test.ts).
import { expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { decideCropBox } from '../../src/lib/jev/decisions/crop-box.ts'
import { imageKindDecision } from '../../src/lib/jev/decisions/image-kind.ts'
import { routeDecision } from '../../src/lib/jev/decisions/image-router.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { fetchBlockDecision, fetchErrorDecision } from '../../src/lib/jev/fetch.ts'
import { fetchBrowserDecision } from '../../src/lib/jev/fetch-browser.ts'
import { nextEvent } from '../../src/lib/jev/machine.ts'

const all = [
  ...Object.values(decisions),
  fetchErrorDecision,
  fetchBlockDecision,
  fetchBrowserDecision,
  nextEvent,
  routeDecision,
  decideCropBox,
  imageKindDecision,
]
// Registry entries that are plain helpers (links, research, mapOrder) own no eval file.
const claimed = all
  .flatMap((d) => {
    const evals = (d as { def?: { evals?: string } }).def?.evals
    return evals ? [evals.replace('tests/jev/evals/', '')] : []
  })
  .sort()
const onDisk = readdirSync(`${import.meta.dir}/evals`)
  .filter((f) => f.endsWith('.json'))
  .sort()

test('every eval file belongs to a registered decision, and no two decisions share one', () => {
  expect(new Set(claimed).size).toBe(claimed.length)
  expect(onDisk).toEqual(claimed)
})
