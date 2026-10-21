// Bias controls applied before any judge sees an answer: provider and tool
// names out, URLs that name a tool out, length cut to a cap, and pairwise
// verdicts kept only when they hold in both orders.
import { Effect, Option } from 'effect'

// Default cap when the task gives none; the spec says "the task's length cap".
const LENGTH_CAP = 4000

// ponytail: fixed brand list; grow it when a new peer joins spec-alternatives.md.
const BRANDS = [
  'webular',
  'anthropic',
  'claude',
  'openai',
  'chatgpt',
  'gemini',
  'google',
  'bing',
  'exa',
  'firecrawl',
  'tavily',
  'brave',
  'perplexity',
  'serper',
  'serpapi',
  'jina',
  'kagi',
  'you\\.com',
  'duckduckgo',
  'websearch',
  'webfetch',
]
const brand = new RegExp(`\\b(${BRANDS.join('|')})\\b`, 'gi')
const mcpTool = /\bmcp__[\w-]+(__[\w-]+)?/g
const url = /\bhttps?:\/\/[^\s)>\]"']+/g

const blindUrl = (u: string) => (new RegExp(brand.source, 'i').test(u) ? '[link]' : u)

export const blind = (text: string, cap = LENGTH_CAP) =>
  text.replace(url, blindUrl).replace(mcpTool, '[tool]').replace(brand, '[tool]').slice(0, cap)

// Runs a pick-the-best judgment on the answers as given and reversed. Returns
// the winner's index only when both orders name the same answer.
export const bothOrders = <A, E, R>(
  answers: readonly A[],
  pick: (ordered: readonly A[]) => Effect.Effect<number, E, R>,
) =>
  Effect.map(
    Effect.all([pick(answers), pick([...answers].reverse())], { concurrency: 1 }),
    ([first, flipped]) =>
      first === answers.length - 1 - flipped ? Option.some(first) : Option.none(),
  )
