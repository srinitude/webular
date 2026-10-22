// cli suggest: which command a user meant by an unknown `webular <word>`, from
// typos and intent words like `fetch`. The edit-distance rule decides below 0.95.
import { COMMAND_NAMES, COMMANDS } from '../../../cli/commands.ts'
import { closest } from '../../../cli/style.ts'
import { defineDecision } from '../define.ts'
import { NONE_OPTION } from '../payload/answers.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

interface SuggestInput {
  readonly command: string
}
const MAX_WORD = 80
const NAMES: ReadonlyArray<string> = COMMAND_NAMES

// null means no suggestion.
export const suggestBaseline = ({ command }: SuggestInput): string | null =>
  closest(command, COMMAND_NAMES) ?? null

const SUGGEST_PURPOSE = purpose(
  'A user typed a word that is not a webular command.',
  'Suggest the command they most likely meant, or none.',
  'A good suggestion saves a trip to the help text; a wrong one sends them to the wrong tool.',
  'The word may be a typo of a command, or a plain word for what a command does, like `fetch` for scrape.',
)
const describe = (k: string): string | null =>
  k === NONE_OPTION
    ? 'Only when the word does not point to any one command here'
    : ((COMMANDS as Record<string, string>)[k] ?? null)

export const suggestDecision = defineDecision<SuggestInput, string | null>({
  name: 'cli.suggest',
  sample: () => ({ command: 'fetch' }),
  subtasks: [
    {
      name: 'command',
      primitive: 'choice',
      pattern: 'intent-routing',
      payload: { question: 'command' },
    },
  ],
  payload: (input) => ({
    state: {
      purpose: SUGGEST_PURPOSE,
      facts: { cli: { typed: input.command.slice(0, MAX_WORD) } },
    },
    // Asked in both option orders (position check); the rule's pick comes first.
    questions: bothOrders(
      'command',
      choice(
        'The user typed `facts.cli.typed` where a webular command name goes. It is a misspelled command name, or an everyday word for what one command does. Which command did they mean?',
        menu(suggestBaseline(input) ?? NONE_OPTION, NAMES, describe),
      ),
    ),
  }),
  read: (a, bar) => {
    const pick = agreedPick(a, 'command', bar, true)
    return pick === NONE_OPTION ? null : NAMES.find((n) => n === pick)
  },
  bar: CONFIDENCE_BAR,
  fallback: suggestBaseline,
  codeCheck: (pick) => pick === null || NAMES.includes(pick),
  evals: 'tests/jev/evals/cli.suggest.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
