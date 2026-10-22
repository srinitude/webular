// Image pilot scoring (pilot-plan.md): two arms on the same pages, a
// sure-but-wrong rate per arm, and the keep rule that decides if the image
// arm stays.

export const ARMS = ['text-only', 'image'] as const
export type Arm = (typeof ARMS)[number]

// A wrong answer at or above this confidence counts as sure-but-wrong.
export const SURE_CONFIDENCE = 0.8

export interface PilotResult {
  readonly arm: Arm
  readonly correct: boolean
  readonly confidence: number
  readonly usd: number
}

export const isSureButWrong = (r: PilotResult): boolean =>
  !r.correct && r.confidence >= SURE_CONFIDENCE

export interface ArmScore {
  readonly passRate: number
  readonly usdPerSuccess: number
  readonly sureButWrongRate: number
}

export const scoreArm = (arm: Arm, results: readonly PilotResult[]): ArmScore => {
  const rows = results.filter((r) => r.arm === arm)
  const passed = rows.filter((r) => r.correct).length
  const wrong = rows.length - passed
  const usd = rows.reduce((sum, r) => sum + r.usd, 0)
  return {
    passRate: rows.length === 0 ? 0 : passed / rows.length,
    usdPerSuccess: passed === 0 ? Number.POSITIVE_INFINITY : usd / passed,
    sureButWrongRate: wrong === 0 ? 0 : rows.filter(isSureButWrong).length / wrong,
  }
}

// The keep rule as data: each line compares the image arm to the baseline.
export const KEEP_RULE = [
  { metric: 'passRate', must: 'hold-or-rise' },
  { metric: 'usdPerSuccess', must: 'drop' },
  { metric: 'sureButWrongRate', must: 'not-rise' },
] as const

const passes = (must: (typeof KEEP_RULE)[number]['must'], base: number, next: number) =>
  must === 'drop' ? next < base : must === 'not-rise' ? next <= base : next >= base

export const keepFailures = (base: ArmScore, image: ArmScore): readonly string[] =>
  KEEP_RULE.filter(({ metric, must }) => !passes(must, base[metric], image[metric])).map(
    ({ metric, must }) => `${metric} must ${must}: ${base[metric]} -> ${image[metric]}`,
  )
