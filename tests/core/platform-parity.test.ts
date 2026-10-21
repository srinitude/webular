// Parity: the resolver table (src/core/platform.ts) names exactly the targets
// mise.toml compiles and the release workflow ships, so a binary the resolver
// looks for always exists in a release, and nothing is built that it ignores.
import { expect, test } from 'bun:test'
import release from '../../.github/workflows/release.yml'
import { assetName, bunTarget, TARGETS } from '../../src/core/platform.ts'
import { loadGraph } from '../_support/graph.ts'

const graph = loadGraph()
const compileRuns = graph['compile:all']?.run as unknown as string[]

test('compile:all builds exactly the resolver targets, each to its asset name', () => {
  const built = compileRuns.map((run) => {
    const target = /--target=(\S+)/.exec(run)?.[1]
    const asset = /dist\/bin\/([^"]+)"/.exec(run)?.[1]
    return `${target} ${asset}`
  })
  expect(built.sort()).toEqual(TARGETS.map((x) => `${bunTarget(x)} ${assetName(x)}`).sort())
})

test('release ships compile:all output and the per-platform packages', () => {
  const steps = JSON.stringify(release)
  expect(steps).toContain('mise run compile:all')
  expect(steps).toContain('mise run package:platforms')
  expect(steps).toContain('dist/bin/webular-*')
  expect(steps).toContain('npm/webular-*')
  expect(graph['package:platforms']?.depends).toEqual(['compile:all'])
})
