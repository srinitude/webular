import { expect, test } from 'bun:test'
import { hitKey, scoreHits } from '../../src/lib/search.ts'

test('one page found through http, www, m, amp, and tracking-link forms is one result', () => {
  const forms = [
    'https://example.com/post',
    'http://example.com/post/',
    'https://www.example.com/post',
    'https://m.example.com/post',
    'https://amp.example.com/post',
    'https://example.com/post/amp',
    'https://example.com/post?utm_source=x&fbclid=1&gclid=2&ref_src=tw#top',
  ]
  expect(new Set(forms.map(hitKey)).size).toBe(1)
})

test('different pages and real query strings stay apart', () => {
  expect(hitKey('https://example.com/a')).not.toBe(hitKey('https://example.com/b'))
  expect(hitKey('https://example.com/s?q=1')).not.toBe(hitKey('https://example.com/s?q=2'))
})

test('a duplicate across lists keeps the longer snippet', () => {
  const short = { title: 't', url: 'https://www.example.com/p', description: 'short' }
  const long = { title: 't', url: 'http://example.com/p/', description: 'a longer snippet' }
  const [top] = scoreHits([[short], [long]], 'x')
  expect(top?.hit.description).toBe('a longer snippet')
})
