// The validator cache is keyed by URL; a secret query param (OpenAlex api_key)
// must never be stored in the key, yet lookups by the real URL still hit.
import { expect, test } from 'bun:test'
import { openCache } from '../../src/lib/fetch-cache.ts'
import { closeSqlite } from '../../src/lib/sqlite-open.ts'

test('cache rows never hold a secret query parameter', () => {
  const cache = openCache(':memory:', 4)
  const url = 'https://api.openalex.org/works?q=x&api_key=sk-live-secret-42'
  cache.store(url, { status: 200, headers: { etag: '"a"' }, body: 'hi', url } as never)
  const keys = (cache.db.query('SELECT url FROM validators').all() as { url: string }[]).map(
    (r) => r.url,
  )
  expect(keys.join()).not.toContain('sk-live-secret-42')
  expect(cache.lookup(url)?.body).toBe('hi')
  closeSqlite(cache.db)
})
