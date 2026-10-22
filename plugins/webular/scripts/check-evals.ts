// Evals: each skill has evals/evals.json with at least 3 cases, and evals/harness.json parses.
import { Effect } from 'effect'
import { exists, files, pluginDir, read, rel, run } from './lib.ts'

const parse = (path: string) =>
  Effect.map(read(path), (text) => {
    try {
      const data: unknown = JSON.parse(text)
      return { ok: true as const, data }
    } catch (e) {
      return { ok: false as const, why: e instanceof Error ? e.message : String(e) }
    }
  })

export const caseCount = (data: unknown) => {
  const evals = (data as { evals?: unknown } | null)?.evals
  return Array.isArray(evals) ? evals.length : 0
}

const checkSkill = (skill: string) =>
  Effect.gen(function* () {
    const path = `${pluginDir}/skills/${skill}/evals/evals.json`
    if (!(yield* exists(path))) return [`${rel(path)}:1: missing evals file`]
    const r = yield* parse(path)
    if (!r.ok) return [`${rel(path)}:1: invalid JSON (${r.why})`]
    const n = caseCount(r.data)
    return n >= 3 ? [] : [`${rel(path)}:1: ${n} eval cases, need at least 3`]
  })

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const skills = new Set(
        (yield* files(`${pluginDir}/skills`)).flatMap((f) => {
          const [skill, file] = f.slice(`${pluginDir}/skills/`.length).split('/')
          return file === 'SKILL.md' && skill ? [skill] : []
        }),
      )
      const perSkill = yield* Effect.forEach([...skills], checkSkill, { concurrency: 8 })
      const harness = `${pluginDir}/evals/harness.json`
      const h = (yield* exists(harness)) ? yield* parse(harness) : null
      const harnessIssue =
        h === null
          ? [`${rel(harness)}:1: missing harness file`]
          : h.ok
            ? []
            : [`${rel(harness)}:1: invalid JSON (${h.why})`]
      return [...perSkill.flat(), ...harnessIssue]
    }),
  )
