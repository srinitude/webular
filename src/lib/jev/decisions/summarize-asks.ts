// Words for the summarize questions: purposes, asks, and core options, in grade-6 English.
import { type OptionSpec, purpose } from '../payload/index.ts'

const MOTIVATION = 'A person asked for a short summary made of real sentences from this page.'
const BACKGROUND =
  'The page may be long. Code already kept the sentences most likely to matter. They are below in page order.'
export const LEAD_PURPOSE = purpose(
  MOTIVATION,
  'The picked sentence goes first in the summary. A wrong pick tells the reader the page is about something else.',
  'A word count alone picks lines that repeat topic words, like greetings and menus, so a careful reader picks instead.',
  BACKGROUND,
)
const PAGE_RULE =
  '`facts.page` gives the page title, which may be empty, and how many sentences it has.'
export const LEAD_ASK = {
  task: 'The summary can keep only one sentence. Which entry of `facts.pool.sentences` should it keep so a reader learns what the page says?',
  answer_wanted: 'Pick the one id that fits best.',
  rules: [
    'Judge what each sentence says, not how often it uses topic words.',
    'The page is about the topic most of its sentences name. Pick the sentence that tells a real fact about that topic.',
    'Greetings, thanks, sign-offs, ads, and small talk about other things are never the pick, even when they come first.',
    PAGE_RULE,
  ],
}
export const EXISTS_ASK =
  'Does at least one entry of `facts.pool.sentences` tell a fact, claim, or step that the page is about?'

const CORE_OPTIONS: Record<string, OptionSpec> = {
  core: {
    what: 'The sentence states a fact, claim, or step that the page is about',
    not_for: 'A sentence that only names the topic while greeting, thanking, or selling',
    examples: ['Deno runs TypeScript files without a build step.'],
  },
  filler: {
    what: 'Only when the sentence is a greeting, welcome, sign-off, thanks, ad, or topic words said again',
    not_for:
      'A fact, even a short one, or a side remark that is neither a fact nor a greeting, sign-off, or ad',
    examples: ['Hi there, Deno lovers, and welcome to our Deno news page!'],
  },
  none: {
    what: 'Only when the sentence is a side remark or opinion: not a fact of the topic, and not a greeting, sign-off, ad, or repeat',
  },
}
export const describeCore = (k: string) => CORE_OPTIONS[k] ?? null
export const CORE_PURPOSE = purpose(
  MOTIVATION,
  'A sentence marked filler is swapped out of the summary for a core sentence. A wrong mark drops a real fact or keeps a greeting.',
  'A word count alone keeps lines that repeat topic words, like greetings and menus.',
  BACKGROUND,
)
export const CORE_ASK = {
  task: 'Is `facts.sentence.text` (the sentence at `facts.sentence.place`) a core point of the page or filler?',
  answer_wanted:
    'Pick core if it tells the reader a fact. Pick filler if it only greets, thanks, sells, or repeats topic words.',
  rules: [
    'Judge what the sentence says, not how often it uses topic words.',
    'Read the entries of `facts.pool.sentences` only to see what the page is about.',
    PAGE_RULE,
  ],
}
