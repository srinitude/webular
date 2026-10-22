// Choice menus and read-every-fact checks: default-first menus ending with
// `none`, the both-orders position check, and request batching.

import {
  type choice,
  type Instructions,
  instructionText,
  NONE_OPTION,
  type OptionSpec,
  picked,
} from './answers.ts'
import { CAPS } from './canonical.ts'

// Choice criteria with one default first: Jev reads a list of equal options as
// a menu and spreads its confidence. Rare options come after, each worded
// "Only when ...". Every menu ends with `none` (the API takes 255 options; our
// cap is CAPS.options in total, `none` included), and `picked` never acts on it.
const NONE_TEXT = 'Only when no other option fits'
export const menu = (
  first: string,
  rest: ReadonlyArray<string>,
  describe: (key: string) => string | OptionSpec | null = () => null,
): Record<string, string | OptionSpec | null> =>
  Object.fromEntries([
    ...[first, ...rest.filter((k) => k !== first)]
      .filter((k) => k !== NONE_OPTION)
      .slice(0, CAPS.options - 1)
      .map((k) => [k, describe(k)]),
    [NONE_OPTION, describe(NONE_OPTION) ?? NONE_TEXT],
  ])

// Position check: jev-1.13 leans toward the first option
// (docs.typesafe.ai/model-jaggedness/jev-1.13), so a Choice that gates an
// action is asked twice in one request, the second time with the options in
// reverse order (`none` stays last). Code acts only when both agree at `bar`.
export const SWAPPED = '_swapped'
type ChoiceShape = ReturnType<typeof choice>
export const bothOrders = (key: string, q: ChoiceShape): Record<string, ChoiceShape> => {
  const keys = Object.keys(q.criteria)
  const tail = keys.at(-1) === NONE_OPTION ? [NONE_OPTION] : []
  const order = [...keys.slice(0, keys.length - tail.length).reverse(), ...tail]
  return {
    [key]: q,
    [`${key}${SWAPPED}`]: {
      ...q,
      criteria: Object.fromEntries(order.map((k) => [k, q.criteria[k] ?? { what: k }])),
    },
  }
}
export const agreedPick = (
  answers: Record<string, unknown>,
  key: string,
  bar: number,
  // Set only by readers that act on an agreed `none` (an empty field, no command, no click).
  keepNone = false,
): string | undefined => {
  const a = picked(answers[key], bar, '', keepNone)
  return a !== '' && a === picked(answers[`${key}${SWAPPED}`], bar, '', keepNone) ? a : undefined
}

// Every key fact must be read by a question: each path two levels down in
// `state` (skipping `purpose` and `context`, which only frame the facts) must
// appear as a backticked path, or a prefix of one, in some instruction.
export const unreadFacts = (req: {
  readonly state: Record<string, unknown>
  readonly questions: Record<string, { readonly instructions: string | Instructions }>
}): string[] => {
  const text = Object.values(req.questions)
    .map((q) => instructionText(q.instructions))
    .join('\n')
  const read = (path: string) =>
    text.includes(`\`${path}\``) || text.includes(`\`${path}.`) || text.includes(`\`${path}[`)
  return Object.entries(req.state).flatMap(([k, v]) => {
    if (k === 'purpose' || k === 'context' || read(k)) return []
    const kids = typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.keys(v) : []
    return kids.length === 0 ? [k] : kids.map((c) => `${k}.${c}`).filter((p) => !read(p))
  })
}

// Splits items into requests of at most CAPS.fields: Jev's per-request batch here.
export const batches = <A>(items: ReadonlyArray<A>, size: number = CAPS.fields): A[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  )
