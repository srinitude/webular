// HTTP 408 is a transient timeout (TypeSafe docs and SDK retry it), and an empty
// or unreadable retry-after header counts as absent so the normal backoff applies.
import { expect, test } from 'bun:test'
import { errorKind, retryAfterMs, retryable } from '../../src/lib/jev/errors.ts'

test('408 is retried on the same model like other transient errors', () => {
  expect(errorKind(408)).toBe('timeout')
  expect(retryable(errorKind(408))).toBe(true)
})

test('empty or invalid retry headers are absent, not 0 ms', () => {
  expect(retryAfterMs({ 'retry-after': '' }, 0)).toBeUndefined()
  expect(retryAfterMs({ 'retry-after': '  ' }, 0)).toBeUndefined()
  expect(retryAfterMs({ 'retry-after': 'soon' }, 0)).toBeUndefined()
  expect(retryAfterMs({ 'retry-after-ms': '', 'retry-after': '2' }, 0)).toBe(2000)
  expect(retryAfterMs({ 'retry-after-ms': '' }, 0)).toBeUndefined()
  expect(retryAfterMs({ 'retry-after-ms': '250' }, 0)).toBe(250)
})
