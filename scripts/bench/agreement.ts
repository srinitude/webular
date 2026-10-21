// Agreement stats for judge calibration and the grader track: Cohen's kappa
// for one rater against gold, Fleiss' kappa for many raters on the same items.
// Pure functions. Report kappa beside raw agreement, since kappa drops under
// heavy label imbalance even when raters agree.

const share = (labels: readonly string[]) => {
  const n = new Map<string, number>()
  for (const l of labels) n.set(l, (n.get(l) ?? 0) + 1)
  return n
}

// 1 when observed agreement is perfect, even if chance agreement is also 1.
const kappaOf = (observed: number, chance: number) =>
  chance === 1 ? 1 : (observed - chance) / (1 - chance)

// Pairs beyond the shorter list are ignored; no pairs gives 0.
export const cohensKappa = (a: readonly string[], b: readonly string[]) => {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  const xs = a.slice(0, n)
  const ys = b.slice(0, n)
  const observed = xs.filter((x, i) => x === ys[i]).length / n
  const sb = share(ys)
  let chance = 0
  for (const [label, count] of share(xs)) chance += (count / n) * ((sb.get(label) ?? 0) / n)
  return kappaOf(observed, chance)
}

// rows[i] holds every rater's label for item i; each row has the same length.
export const fleiss = (rows: readonly (readonly string[])[]) => {
  const raters = rows[0]?.length ?? 0
  const total = share(rows.flat())
  const perItem = rows.map((row) => {
    let pairs = 0
    for (const count of share(row).values()) pairs += count * (count - 1)
    return pairs / (raters * (raters - 1))
  })
  const observed = perItem.reduce((s, p) => s + p, 0) / rows.length
  let chance = 0
  for (const count of total.values()) chance += (count / (rows.length * raters)) ** 2
  return kappaOf(observed, chance)
}
