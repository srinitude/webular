// Payload lint: the rules the decision-models mod enforces, applied to webular
// payloads. Each finding names the field and what it needs.
// 1. The model is a pinned, versioned id (`jev-<major>.<minor>.<patch>`), never the `jev-latest` alias.
// 2. Choice options and Score levels are objects with a `what`, never bare strings.
// 3. No part appears twice: no repeated long state string, no repeated instructions.
// 4. No writing or math step goes to Jev: it judges; code and LLMs write and count.
import type { JevRequest } from '../client.ts'
import { JEV_LATEST_RELEASED } from '../model.ts'
import { instructionText } from '../payload/answers.ts'

interface Finding {
  readonly rule: 'model-pin' | 'structured-options' | 'duplicate-part' | 'not-a-judgment'
  readonly where: string
  readonly message: string
}

const PINNED = /^jev-\d+\.\d+\.\d+$/
export const lintModel = (model: string): Finding[] =>
  PINNED.test(model)
    ? []
    : [
        {
          rule: 'model-pin',
          where: 'model',
          message: `model ${model} (needs a versioned id like ${JEV_LATEST_RELEASED})`,
        },
      ]

const isWhat = (v: unknown) => typeof v === 'object' && v !== null && 'what' in v

const optionFindings = (id: string, q: JevRequest['questions'][string]): Finding[] => {
  if (q.type === 'choice')
    return Object.entries(q.criteria as Record<string, unknown>)
      .filter(([, v]) => !isWhat(v))
      .map(([k]) => ({
        rule: 'structured-options' as const,
        where: `questions.${id}.criteria.${k}`,
        message: `choice option ${k} (needs an object with a what, not a bare string)`,
      }))
  if (q.type === 'score')
    return (q.criteria as ReadonlyArray<unknown>).flatMap((v, i) =>
      isWhat(v)
        ? []
        : [
            {
              rule: 'structured-options' as const,
              where: `questions.${id}.criteria.${i}`,
              message: `score level ${i} (needs an object with a what, not a bare string)`,
            },
          ],
    )
  return []
}

const MIN_DUP = 40 // shorter strings (labels, urls' hosts) may repeat on purpose
const longStrings = (v: unknown, path: string, out: Array<[string, string]>, depth = 0): void => {
  if (depth > 16) return
  if (typeof v === 'string' && v.length >= MIN_DUP) out.push([path, v])
  else if (typeof v === 'object' && v !== null)
    for (const [k, x] of Object.entries(v)) longStrings(x, `${path}.${k}`, out, depth + 1)
}

const duplicates = (req: JevRequest): Finding[] => {
  const parts: Array<[string, string]> = []
  longStrings(req.state, 'state', parts)
  for (const [id, q] of Object.entries(req.questions))
    parts.push([`questions.${id}.instructions`, instructionText(q.instructions)])
  const seen = new Map<string, string>()
  return parts.flatMap(([where, s]) => {
    const first = seen.get(s)
    if (first === undefined) {
      seen.set(s, where)
      return []
    }
    return [
      { rule: 'duplicate-part' as const, where, message: `repeats ${first} (send each part once)` },
    ]
  })
}

// `count` only as a verb: "a view count" names a fact, "count the links" asks for math.
const WRITING_OR_MATH =
  /\b(write|rewrite|summari[sz]e|draft|compose|generate|translate|calculate|compute|count (?:the|how|all|every|each)|how many|add up|sum of|average of)\b/i

const judgments = (req: JevRequest): Finding[] =>
  Object.entries(req.questions)
    .filter(([, q]) => WRITING_OR_MATH.test(instructionText(q.instructions)))
    .map(([id]) => ({
      rule: 'not-a-judgment' as const,
      where: `questions.${id}.instructions`,
      message: 'asks Jev to write or do math (Jev judges; send writing to an LLM and math to code)',
    }))

export const lintPayload = (req: JevRequest, model?: string): Finding[] => [
  ...(model === undefined ? [] : lintModel(model)),
  ...Object.entries(req.questions).flatMap(([id, q]) => optionFindings(id, q)),
  ...duplicates(req),
  ...judgments(req),
]

// Source lint: a quoted `jev-latest` model string in code. Comments and the
// docs fixture may name the alias; code that sends it may not.
export const sendsLatest = (source: string): number[] =>
  source.split('\n').flatMap((line, i) => {
    const code = line.replace(/\/\/.*$/, '')
    return /['"`]jev-latest['"`]/.test(code) ? [i + 1] : []
  })

// The jev mod DEFINITION rules, stricter than lintPayload.
export { lintDefinition, lintSubtasks } from './definition-lint.ts'
