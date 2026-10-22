// Summarize gold: key-fact recall (docs/command-parity.md). One `contains`
// check per gold fact, so a task passes only when the summary keeps every fact.
// The local fixture article is webular-only (a hosted API cannot reach it); the
// public page is the arm both peers can read.
import type { Task } from './model.ts'

const summarize = (id: string, url: string, facts: readonly string[], localOnly = false): Task => ({
  id,
  job: 'summarize',
  suite: 'summarize',
  input: { url },
  checks: facts.map((f) => ({ kind: 'contains', values: [f] })),
  ...(localOnly ? { localOnly } : {}),
})

export const summarizeTasks: readonly Task[] = [
  summarize(
    'summarize-fixture-article',
    '{fixture}/article',
    ['16 metres', '2009', '100 billion tonnes'],
    true,
  ),
  summarize('summarize-example-domain', 'https://example.com/', [
    'Example Domain',
    'illustrative examples',
  ]),
]
