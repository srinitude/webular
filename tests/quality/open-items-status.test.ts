// Guard: every "- " line under a "## " heading of docs/research/open-items.md carries
// exactly one status: landed in <sha>, closed (<reason kind>) plus a reason, or waiting: plus text.

import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const STATUS = [
  /landed in [0-9a-f]{7,40}\b/g,
  /closed \((?:duplicate|superseded|measured no gain|out of scope)\):? \S/g,
  /waiting: \S/g,
]

/** List items under a "## " heading with no status or more than one, as "line N: text". */
const badItems = (text: string) => {
  let inSection = false
  return text.split('\n').flatMap((line, i) => {
    if (line.startsWith('## ')) inSection = true
    else if (line.startsWith('# ')) inSection = false
    if (!inSection || !line.startsWith('- ')) return []
    const count = STATUS.reduce((n, re) => n + (line.match(re)?.length ?? 0), 0)
    return count === 1 ? [] : [`line ${i + 1}: ${line}`]
  })
}

describe('open-items statuses', () => {
  test('sample lines: valid pass, missing or doubled fail', () => {
    const ok = [
      '## A',
      '- #1 landed in abc1234',
      '- #2 closed (duplicate) of #1',
      '- #3 waiting: a receipt',
    ]
    expect(badItems(ok.join('\n'))).toEqual([])
    const bad = [
      '## A',
      '- #1 no status',
      '- #2 landed in abc1234 waiting: x',
      '- #3 closed (duplicate)',
    ]
    expect(badItems(bad.join('\n'))).toHaveLength(3)
  })

  test(
    'every entry in docs/research/open-items.md has exactly one status',
    eff(
      Effect.gen(function* () {
        const text = yield* (yield* FileSystem.FileSystem).readFileString(
          `${ROOT}docs/research/open-items.md`,
        )
        expect(badItems(text)).toEqual([])
      }),
    ),
  )
})
