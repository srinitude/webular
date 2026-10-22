// Live runs write under bench/results; replay reads bench/recordings.
import { expect, test } from 'bun:test'
import { livePath, replayPath } from '../../scripts/bench/peers/recording-paths.ts'

test('live recordings land under bench/results, replay reads bench/recordings', () => {
  expect(livePath('/r/bench/', 'abc')).toBe('/r/bench/results/recordings/abc.json')
  expect(replayPath('/r/bench/', 'abc')).toBe('/r/bench/recordings/abc.json')
})
