// The model x arm x scenario grid a matrix run walks, narrowed by flags. An
// arm is a webular surface, or the peer surface once per provider. Within
// each model and task, the arms run in a seeded random order.
import { WEBULAR } from './agent/arm.ts'
import type { Provider, Scenario, ScenarioFile, Surface } from './scenarios.ts'

export interface Job {
  file: ScenarioFile
  s: Scenario
  model: string
  surface: Surface
  provider: string
  peer: Provider | undefined
  attempt: number
  seed: string
  rawPath: string
}

export const ARM_SEED = 'arm-order'

const list = (v: string | undefined) => (v ? v.split(',') : undefined)

interface Flags {
  models?: string | undefined
  surfaces?: string | undefined
  scenarios?: string | undefined
  providers?: string | undefined
  seed?: string | undefined
}

type Arm = Pick<Job, 'surface' | 'provider' | 'peer'>

const arms = (file: ScenarioFile, surfaces: readonly Surface[], only?: string[]): Arm[] =>
  surfaces.flatMap((surface) =>
    surface === 'peer'
      ? (file.providers ?? [])
          .filter((p) => !only || only.includes(p.id))
          .map((p): Arm => ({ surface, provider: p.id, peer: p }))
      : [{ surface, provider: WEBULAR, peer: undefined }],
  )

const fits = (file: ScenarioFile, s: Scenario) => (arm: Arm) =>
  arm.surface === 'peer' || (s.surfaces ?? file.surfaces).includes(arm.surface)

// The same seed, model, and task always give the same arm order.
const seeded = (seed: string, model: string, s: Scenario, list: Arm[]) =>
  list
    .map((a) => [Bun.hash(`${seed}|${model}|${s.id}|${a.surface}/${a.provider}`), a] as const)
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([, a]) => a)

const armJobs =
  (file: ScenarioFile, name: string, model: string, s: Scenario, repeats: number, seed: string) =>
  (arm: Arm): Job[] =>
    Array.from({ length: repeats }, (_, i) => ({
      file,
      s,
      model,
      ...arm,
      attempt: i + 1,
      seed,
      rawPath: `bench/results/raw/${name}/${model}-${arm.surface}-${arm.provider}-${s.id}${repeats > 1 ? `-r${i + 1}` : ''}.jsonl`,
    }))

export const jobsFor = (
  file: ScenarioFile,
  name: string,
  smoke: boolean,
  values: Flags,
  repeats = 1,
): Job[] => {
  const models = list(values.models) ?? file.models
  const surfaces = (list(values.surfaces) ?? (smoke ? ['cli'] : file.surfaces)) as Surface[]
  const ids = list(values.scenarios) ?? (smoke ? [file.smoke] : file.scenarios.map((s) => s.id))
  const seed = values.seed ?? ARM_SEED
  const all = arms(file, surfaces, list(values.providers))
  return models.flatMap((model) =>
    file.scenarios
      .filter((s) => ids.includes(s.id))
      .flatMap((s) =>
        seeded(seed, model, s, all.filter(fits(file, s))).flatMap(
          armJobs(file, name, model, s, repeats, seed),
        ),
      ),
  )
}
