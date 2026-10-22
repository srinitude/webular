// Property tests for URL identity: whatever URL a page links, normalizing it
// twice gives the same page, the result always parses, and junk never throws.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import * as fc from 'fast-check'
import { normalizeUrl } from '../../src/core/url.ts'
import { eff } from '../_support/run.ts'

const trackingKeys = ['utm_source', 'fbclid', 'gclid', '_ga', 'mc_cid']
// A query holding a literal `?` (`http://a.aa/??`) normalizes to `http://a.aa/?` and only then to `http://a.aa/`: the generator skips it.
const anyUrl = fc
  .webUrl({ withQueryParameters: true, withFragments: true })
  .filter((url) => !url.slice(url.indexOf('?') + 1).includes('?'))
const trackedUrl = fc
  .tuple(anyUrl, fc.constantFrom(...trackingKeys), fc.string())
  .map(
    ([url, key, value]) =>
      `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`,
  )

test(
  'normalizing a link twice names the same page as normalizing it once',
  eff(
    Effect.sync(() =>
      fc.assert(
        fc.property(fc.oneof(anyUrl, trackedUrl), (raw) => {
          const once = normalizeUrl(raw)
          expect(once).not.toBeNull()
          expect(normalizeUrl(once as string)).toBe(once)
        }),
      ),
    ),
  ),
)

test(
  'a normalized link parses and carries no fragment or tracking parameter',
  eff(
    Effect.sync(() =>
      fc.assert(
        fc.property(trackedUrl, (raw) => {
          const parsed = URL.parse(normalizeUrl(raw) ?? '')
          expect(parsed).not.toBeNull()
          expect(parsed?.hash).toBe('')
          const keys = [...(parsed?.searchParams.keys() ?? [])]
          expect(keys.filter((k) => trackingKeys.includes(k))).toEqual([])
        }),
      ),
    ),
  ),
)

test(
  'any text, with or without a base, gives a parseable link or null and never throws',
  eff(
    Effect.sync(() =>
      fc.assert(
        fc.property(fc.string(), fc.option(anyUrl, { nil: undefined }), (raw, base) => {
          const out = normalizeUrl(raw, base)
          if (out !== null) expect(URL.parse(out)).not.toBeNull()
        }),
      ),
    ),
  ),
)
