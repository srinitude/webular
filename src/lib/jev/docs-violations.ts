// Every limit the docs state, checked before the call. Returns the broken rules.
import { committedSnapshot, DECISION_MODELS, type DocsLimits } from './docs-snapshot.ts'

const depth = (v: unknown): number =>
  v !== null && typeof v === 'object' ? 1 + Math.max(0, ...Object.values(v).map(depth)) : 0
const finite = (v: unknown): boolean =>
  typeof v === 'number'
    ? Number.isFinite(v)
    : v !== null && typeof v === 'object'
      ? Object.values(v).every(finite)
      : true
export const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const questionViolations = (id: string, raw: unknown, limits: DocsLimits): string[] => {
  const q = isObject(raw) ? raw : {}
  const out: string[] = []
  if (!limits.types.includes(String(q['type'])))
    out.push(`${id}: type ${String(q['type'])} not in the docs`)
  if (depth(q['instructions']) > limits.nesting || depth(q['criteria']) > limits.nesting)
    out.push(`${id}: nests past ${limits.nesting}`)
  const n =
    q['criteria'] !== null && typeof q['criteria'] === 'object'
      ? Object.keys(q['criteria']).length
      : 0
  if (q['type'] === 'choice' && (n < 1 || n > limits.choiceMax))
    out.push(`${id}: ${n} options, docs allow 1 to ${limits.choiceMax}`)
  if (
    q['type'] === 'score' &&
    (!Array.isArray(q['criteria']) || n < limits.scoreMin || n > limits.scoreMax)
  )
    out.push(`${id}: ${n} levels, docs allow ${limits.scoreMin} to ${limits.scoreMax}`)
  return out
}

export const violations = (
  req: unknown,
  limits: DocsLimits = committedSnapshot.limits,
  bytes = 0,
): string[] => {
  const out: string[] = []
  if (bytes > limits.bodyBytes) out.push(`body over ${limits.bodyBytes} bytes`)
  const r = isObject(req) ? req : {}
  const model = r['model']
  if (typeof model !== 'string' || !DECISION_MODELS.some((m) => m.models.test(model)))
    out.push('model missing or not a registered decision model')
  if (depth(r['state']) > limits.nesting) out.push(`state nests past ${limits.nesting}`)
  if (!finite(r)) out.push('a number is not finite')
  const qs = Object.entries(isObject(r['questions']) ? r['questions'] : {})
  if (qs.length === 0) out.push('questions empty')
  for (const [id, raw] of qs) out.push(...questionViolations(id, raw, limits))
  return out
}
