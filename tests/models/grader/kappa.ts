// Agreement stats for the grader track: Cohen's kappa for one rater against
// gold, Fleiss' kappa for many raters on the same items. Pure functions.

const share = (labels: readonly string[]) => {
  const n = new Map<string, number>()
  for (const l of labels) n.set(l, (n.get(l) ?? 0) + 1)
  return n
}

// 1 when observed agreement is perfect, even if chance agreement is also 1.
const kappaOf = (observed: number, chance: number) =>
  chance === 1 ? 1 : (observed - chance) / (1 - chance)

export const cohen = (a: readonly string[], b: readonly string[]) => {
  const n = a.length
  const observed = a.filter((x, i) => x === b[i]).length / n
  const sa = share(a)
  const sb = share(b)
  let chance = 0
  for (const [label, count] of sa) chance += (count / n) * ((sb.get(label) ?? 0) / n)
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
