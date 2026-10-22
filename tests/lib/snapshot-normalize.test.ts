// Monitor diffs ignore whitespace churn but still catch edits to repeated lines.
import { expect, test } from 'bun:test'
import { Effect, Path } from 'effect'
import { compareAndStore } from '../../src/lib/snapshot.ts'
import { eff, tmpDir } from '../_support/run.ts'

const db = Effect.gen(function* () {
  return (yield* Path.Path).join(yield* tmpDir('snapshot-normalize-'), 's.db')
})

test(
  'whitespace-only changes read as same',
  eff(
    Effect.gen(function* () {
      const path = yield* db
      yield* compareAndStore(path, 'https://a.test/', 'Price  is 5\n\n\nBuy now')
      const r = yield* compareAndStore(path, 'https://a.test/', '  Price is 5 \nBuy   now\n')
      expect(r.changeStatus).toBe('same')
    }),
  ),
)

test(
  'a price repeated on the page still shows as changed',
  eff(
    Effect.gen(function* () {
      const path = yield* db
      yield* compareAndStore(path, 'https://b.test/', '$10\nOne\n$10\nTwo\n$10')
      const r = yield* compareAndStore(path, 'https://b.test/', '$12\nOne\n$12\nTwo\n$12')
      expect(r.changeStatus).toBe('changed')
      expect(r.diff).toContain('+$12')
    }),
  ),
)
