// Contract for the search step's private-host filter: loopback and private
// hosts drop from web results by default, a query that names the host keeps
// it, and the configured local source origin (WEBULAR_SOURCE_ORIGIN, read
// through the ConfigProvider) is kept, that exact origin only.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { dropPrivateHosts } from '../../src/lib/local-index.ts'

const hits = [
  'http://localhost:54096/a',
  'http://127.0.0.1/b',
  'http://[::1]/c',
  'http://10.1.2.3/d',
  'http://172.20.0.1/e',
  'http://192.168.1.5/f',
  'http://169.254.0.9/g',
  'http://box.local/h',
  'http://172.32.0.1/ok',
  'https://example.com/ok',
].map((url) => ({ url }))

const PUBLIC = ['http://172.32.0.1/ok', 'https://example.com/ok']

// env is the whole ConfigProvider, so the outer process env never leaks in.
const kept = (query: string, env: Record<string, string> = {}) =>
  Effect.runSync(
    Effect.provideService(
      dropPrivateHosts(query, hits),
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown(env),
    ),
  ).map((h) => h.url)

test('private and loopback hosts drop by default unless the query names them', () => {
  expect(kept('tides')).toEqual(PUBLIC)
  expect(kept('see localhost:54096')).toContain('http://localhost:54096/a')
})

test('the configured source origin is kept; other ports and private hosts still drop', () => {
  expect(kept('tides', { WEBULAR_SOURCE_ORIGIN: 'http://localhost:54096' })).toEqual([
    'http://localhost:54096/a',
    ...PUBLIC,
  ])
  expect(kept('tides', { WEBULAR_SOURCE_ORIGIN: 'http://localhost:9' })).toEqual(PUBLIC)
  expect(kept('tides', { WEBULAR_SOURCE_ORIGIN: 'not a url' })).toEqual(PUBLIC)
})
