// The validator cache writes a row and its eviction in one transaction:
// when eviction fails, the new row does not stay either.
import { describe, expect, test } from 'bun:test'
import { openCache } from '../../src/lib/fetch-cache.ts'
import { closeSqlite } from '../../src/lib/sqlite-open.ts'

const reply = { status: 200, headers: { etag: '"a"' }, body: 'hi', url: 'https://x.test/' }

describe('fetch-cache store', () => {
  test('put and evict commit together', () => {
    const cache = openCache(':memory:', 0)
    cache.db.run(
      "CREATE TRIGGER no_delete BEFORE DELETE ON validators BEGIN SELECT RAISE(ABORT, 'blocked'); END",
    )
    expect(() => cache.store('https://x.test/', reply as never)).toThrow('blocked')
    expect(cache.lookup('https://x.test/')).toBeNull()
    closeSqlite(cache.db)
  })

  test('a stored row stays within the row bound', () => {
    const cache = openCache(':memory:', 1)
    cache.store('https://x.test/a', reply as never)
    cache.store('https://x.test/b', reply as never)
    expect(cache.lookup('https://x.test/a')).toBeNull()
    expect(cache.lookup('https://x.test/b')?.etag).toBe('"a"')
    closeSqlite(cache.db)
  })
})
