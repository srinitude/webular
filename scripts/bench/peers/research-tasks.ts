// Research gold: multi-hop questions with one stable answer each, written like
// the `qa(...)` helper in tasks.ts. Aliases cover spelling variants.
import type { Task } from './model.ts'

const research = (id: string, query: string, answers: string[]): Task => ({
  id,
  job: 'research',
  suite: 'research',
  input: { query },
  checks: [{ kind: 'contains', values: answers }],
  answers,
})

export const researchTasks: readonly Task[] = [
  research(
    'research-imitation-game-university',
    'Which university did the mathematician who proposed the imitation game attend as an undergraduate?',
    ['Cambridge'],
  ),
  research(
    'research-two-sciences-nobel-birthplace',
    'In which city was the first person to win Nobel Prizes in two different sciences born?',
    ['Warsaw'],
  ),
  research(
    'research-everest-first-ascent-country',
    'The mountaineer who made the first confirmed ascent of Mount Everest with Tenzing Norgay was a citizen of which country?',
    ['New Zealand'],
  ),
]
