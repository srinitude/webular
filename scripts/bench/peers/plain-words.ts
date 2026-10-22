// Plain words for the benchmark pages: a run's date instead of a bare file
// name, each metric's meaning and which way is better, and a verdict that says
// whether webular is ahead of, even with, or behind the best rival.
const MONTHS = [
  'Jan.',
  'Feb.',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
]
const STAMP = /(\d{4})-(\d{2})-(\d{2})[T-](\d{2})-?(\d{2})/

// "peers-2026-10-22T14-51-52-746Z.json" -> "Oct. 22, 2026 at 14:51 UTC".
export const runDate = (name: string) => {
  const [, y, mo, d, h, mi] = STAMP.exec(name) ?? []
  return y ? `${MONTHS[Number(mo) - 1]} ${Number(d)}, ${y} at ${h}:${mi} UTC` : name
}

// Shared-task table rows: report key, label, and which way is better.
export const SHARED = [
  ['accuracy', 'accuracy (share right)', 'higher'],
  ['citationPrecision', 'citation precision (sources that back the answer)', 'higher'],
  ['latencyP50Ms', 'median wait, p50 (ms)', 'lower'],
  ['latencyP95Ms', 'slow-case wait, p95 (ms)', 'lower'],
  ['successRate', 'success rate (calls with no error)', 'higher'],
  ['determinism', 'determinism (same output each run)', 'higher'],
  ['costPerCallUsd', 'cost per call (USD)', 'lower'],
  ['keysNeeded', 'keys needed', 'fewer'],
] as const

type Scored = { tool: string; score: number }

// Webular against the best rival on one job, compared at the three decimals shown.
export const verdict = (w: Scored | undefined, peers: readonly Scored[]) => {
  const best = peers.toSorted((a, b) => b.score - a.score)[0]
  if (!w || !best) return 'No rival scored this job, so there is nothing to compare.'
  const [mine, theirs] = [w.score.toFixed(3), best.score.toFixed(3)]
  const word = mine > theirs ? 'ahead of' : mine < theirs ? 'behind' : 'even with'
  return `Webular is ${word} the best rival, ${best.tool}.`
}
