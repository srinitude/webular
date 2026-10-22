// Parse gold: a stable public PDF whose body text is known. A task passes when
// the parsed text holds the gold phrase.
import type { Task } from './model.ts'

export const parseTasks: readonly Task[] = [
  {
    id: 'parse-w3c-dummy-pdf',
    job: 'parse',
    suite: 'parse',
    input: { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    checks: [{ kind: 'contains', values: ['Dummy PDF file'] }],
  },
]
