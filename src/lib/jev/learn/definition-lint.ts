// Definition lint: the jev mod's DEFINITION rules for a decision payload, stricter
// than lintPayload. Webular's JevRequest type still allows bare-string instructions
// and options, so these rules run here instead of in defineDecision's type.
// Errors block a definition; warnings advise.
import { JEV_LATEST_RELEASED } from '../model.ts'

type DefinitionRule =
  | 'instructions-object'
  | 'choice-criteria'
  | 'score-levels'
  | 'state-shape'
  | 'model-pin'
  | 'request-size'
  | 'question-size'
  | 'nesting'
  | 'none-of-the-above'
  | 'near-duplicate-options'
  | 'state-size'
  | 'subtask-shape'

interface DefinitionFinding {
  readonly rule: DefinitionRule
  readonly level: 'error' | 'warning'
  readonly where: string
  readonly message: string
}

// Jev limits are tokens (llms-full.txt L14441, L14452-14457): 64k per request (state plus all
// questions), 32k per question (state plus one). No documented chars-per-token rule: chars / 4.
// ponytail: chars / 4 runs low on dense JSON; read usage.input_tokens back if a request nears a cap.
export const estTokens = (v: unknown) => Math.ceil(JSON.stringify(v).length / 4)

const DEFINITION_LIMITS = {
  requestTokens: 64_000,
  questionTokens: 32_000,
  nesting: 64,
  stateBytes: 8_192,
  stateDepth: 2,
  minOptions: 2,
  minLevels: 2,
  maxLevels: 10,
} as const

// Webular keeps motivation, outcome, why, and background under `state['purpose']`;
// the mod's top-level spelling passes too.
const STATE_KEYS = ['facts', 'motivation', 'outcome', 'why', 'background'] as const
const NONE_KEYS = new Set(['none', 'noneoftheabove', 'noneofthese', 'neither', 'other'])
const PRIMITIVES = new Set(['choice', 'score', 'noul'])
const PATTERNS = new Set([
  'fan-out',
  'confidence-routing',
  'composite-scoring',
  'intent-routing',
  'none',
])
const utf8 = new TextEncoder()

const finding =
  (level: DefinitionFinding['level']) =>
  (rule: DefinitionRule, where: string, message: string): DefinitionFinding => ({
    rule,
    level,
    where,
    message,
  })
const err = finding('error')
const warn = finding('warning')

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const filled = (v: unknown) =>
  typeof v === 'string'
    ? v.trim() !== ''
    : Array.isArray(v)
      ? v.length > 0
      : isObj(v)
        ? Object.keys(v).length > 0
        : v !== undefined && v !== null

// Nesting levels of objects and arrays. The walk stops past the nesting limit;
// it still visits every value up to that depth, which is fine for CI samples.
const depth = (v: unknown, d = 0): number => {
  if (typeof v !== 'object' || v === null || d > DEFINITION_LIMITS.nesting) return d
  let max = d + 1
  for (const x of Object.values(v)) max = Math.max(max, depth(x, d + 1))
  return max
}
const near = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const choiceFindings = (at: string, c: unknown): DefinitionFinding[] => {
  if (!isObj(c) || Object.keys(c).length < DEFINITION_LIMITS.minOptions)
    return [err('choice-criteria', `${at}.criteria`, 'needs a map of at least 2 options')]
  const out = Object.entries(c)
    .filter(([, v]) => !isObj(v) || !filled(v['what']))
    .map(([k]) => err('choice-criteria', `${at}.criteria.${k}`, `option ${k} needs {what}`))
  const seen = new Set<string>()
  for (const k of Object.keys(c)) {
    const n = near(k)
    if (NONE_KEYS.has(n))
      out.push(warn('none-of-the-above', `${at}.criteria.${k}`, 'a none-of-the-above option'))
    if (seen.has(n))
      out.push(warn('near-duplicate-options', `${at}.criteria.${k}`, 'near-duplicate option'))
    seen.add(n)
  }
  return out
}

const scoreFindings = (at: string, c: unknown): DefinitionFinding[] => {
  const { minLevels, maxLevels } = DEFINITION_LIMITS
  if (!Array.isArray(c) || c.length < minLevels || c.length > maxLevels)
    return [err('score-levels', `${at}.criteria`, 'needs 2 to 10 levels')]
  return c.flatMap((v, i) =>
    isObj(v) && (filled(v['what']) || filled(v['description']))
      ? []
      : [err('score-levels', `${at}.criteria.${i}`, `level ${i} needs {what} or {description}`)],
  )
}

const questionFindings = (id: string, q: unknown, state: unknown): DefinitionFinding[] => {
  const at = `questions.${id}`
  if (!isObj(q)) return [err('instructions-object', at, 'needs a question object')]
  const out: DefinitionFinding[] = []
  if (!isObj(q['instructions']))
    out.push(err('instructions-object', `${at}.instructions`, 'needs a structured object'))
  if (q['type'] === 'choice') out.push(...choiceFindings(at, q['criteria']))
  if (q['type'] === 'score') out.push(...scoreFindings(at, q['criteria']))
  if (estTokens({ state, q }) > DEFINITION_LIMITS.questionTokens)
    out.push(err('question-size', at, 'state plus question over an estimated 32,000 tokens'))
  return out
}

const stateFindings = (state: unknown): DefinitionFinding[] => {
  if (!isObj(state)) return [err('state-shape', 'state', 'needs an object')]
  const purpose = isObj(state['purpose']) ? state['purpose'] : {}
  const out = STATE_KEYS.filter((k) => !filled(state[k]) && !filled(purpose[k])).map((k) =>
    err('state-shape', `state.${k}`, `needs a non-empty ${k}`),
  )
  if (depth(state) < DEFINITION_LIMITS.stateDepth)
    out.push(err('state-shape', 'state', 'needs at least 2 levels of nesting'))
  if (utf8.encode(JSON.stringify(state)).length > DEFINITION_LIMITS.stateBytes)
    out.push(warn('state-size', 'state', 'over 8,192 bytes'))
  return out
}

interface DefinitionPayload {
  readonly model: string
  readonly state: unknown
  readonly questions: unknown
}

export const lintDefinition = (req: DefinitionPayload): DefinitionFinding[] => {
  const out = stateFindings(req.state)
  if (req.model !== JEV_LATEST_RELEASED)
    out.push(
      err('model-pin', 'model', `${req.model} is not the pinned release ${JEV_LATEST_RELEASED}`),
    )
  if (!isObj(req.questions)) out.push(err('instructions-object', 'questions', 'needs a map'))
  else
    for (const [id, q] of Object.entries(req.questions))
      out.push(...questionFindings(id, q, req.state))
  if (estTokens(req) > DEFINITION_LIMITS.requestTokens)
    out.push(err('request-size', '', 'request over an estimated 64,000 tokens'))
  if (depth(req) > DEFINITION_LIMITS.nesting) out.push(err('nesting', '', 'nesting over 64 levels'))
  return out
}

// Decomposition steps: a step with no `route`, or route 'jev', goes to Jev and
// needs a primitive, a pattern, and a full payload that passes lintDefinition.
export const lintSubtasks = (steps: ReadonlyArray<unknown>): DefinitionFinding[] =>
  steps.flatMap((s, i) => {
    const at = `subtasks.${i}`
    if (!isObj(s)) return [err('subtask-shape', at, 'needs an object')]
    if (s['route'] !== undefined && s['route'] !== 'jev') return []
    const out: DefinitionFinding[] = []
    if (!PRIMITIVES.has(String(s['primitive'])))
      out.push(err('subtask-shape', `${at}.primitive`, 'needs choice, score, or noul'))
    if (!PATTERNS.has(String(s['pattern'])))
      out.push(err('subtask-shape', `${at}.pattern`, 'needs a known pattern'))
    const p = s['payload']
    if (!isObj(p) || typeof p['model'] !== 'string' || !isObj(p['state']) || !isObj(p['questions']))
      out.push(err('subtask-shape', `${at}.payload`, 'needs {model, state, questions}'))
    else
      for (const f of lintDefinition({
        model: p['model'],
        state: p['state'],
        questions: p['questions'],
      }))
        out.push({ ...f, where: `${at}.payload.${f.where}` })
    return out
  })
