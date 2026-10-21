// The model x surface x scenario grid a matrix run walks, narrowed by flags.
import type { Scenario, ScenarioFile, Surface } from './scenarios.ts'

export interface Job {
  file: ScenarioFile
  s: Scenario
  model: string
  surface: Surface
  rawPath: string
}

const list = (v: string | undefined) => (v ? v.split(',') : undefined)

export const jobsFor = (
  file: ScenarioFile,
  name: string,
  smoke: boolean,
  values: { models?: string; surfaces?: string; scenarios?: string },
): Job[] => {
  const models = list(values.models) ?? file.models
  const surfaces = (list(values.surfaces) ?? (smoke ? ['cli'] : file.surfaces)) as Surface[]
  const ids = list(values.scenarios) ?? (smoke ? [file.smoke] : file.scenarios.map((s) => s.id))
  return models.flatMap((model) =>
    surfaces.flatMap((surface) =>
      file.scenarios
        .filter((s) => ids.includes(s.id) && (s.surfaces ?? file.surfaces).includes(surface))
        .map((s) => ({
          file,
          s,
          model,
          surface,
          rawPath: `bench/results/raw/${name}/${model}-${surface}-${s.id}.jsonl`,
        })),
    ),
  )
}
