// Minimal goal planner for `act --goal`: plain text in, semantic intents out.
// Each step ("click X", split on "then", commas, or semicolons) names its
// target by its quoted phrases, else by the words after "click". The text
// quoted after "until it says" is what the last step must make appear.
// ponytail: phrase rules only; a model planner replaces this when goals grow
// past "click X [then click Y] [until it says Z]".
import type { Intent } from './cua-ground.ts'

const QUOTED = /"([^"]+)"|'([^']+)'/g

const quoted = (text: string) =>
  [...text.matchAll(QUOTED)].map((m) => (m[1] ?? m[2] ?? '').trim()).filter(Boolean)

const shows = (text: string) => ({ element: { selector: { label_contains: text }, exists: true } })

export const planGoal = (goal: string): Intent[] => {
  const [steps = '', until = ''] = goal.split(/\buntil\b/i)
  const endText = quoted(until)[0]
  const labels = steps.split(/\bthen\b|[,;]/i).flatMap((step) => {
    const inQuotes = quoted(step)
    if (inQuotes.length > 0) return inQuotes
    const after = /\bclick\s+(?:on\s+)?(?:the\s+)?(.+)/i.exec(step)?.[1]?.trim()
    return after ? [after] : []
  })
  return labels.map((label, i) => ({
    label,
    expect: shows(i === labels.length - 1 && endText ? endText : label),
  }))
}
