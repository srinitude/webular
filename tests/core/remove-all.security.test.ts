// Tag and comment stripping: a tag or comment split by another one cannot
// join back up once the inner one is removed.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { removeAll } from '../../src/core/remove-all.ts'
import { plain } from '../../src/lib/sources-search.ts'
import { withoutComments } from '../../src/workflows/map-xml.ts'
import { eff } from '../_support/run.ts'

test(
  'a split script tag leaves no tag behind in plain text',
  eff(
    Effect.sync(() => {
      expect(removeAll('<<b>b>x<<i>/i>', /<[^>]+>/g)).toBe('b>x/i>')
      expect(plain('a <scr<i>ipt>b')).not.toContain('<')
    }),
  ),
)

test(
  'a split sitemap comment leaves no comment opener behind',
  eff(
    Effect.sync(() => {
      expect(withoutComments('<url><!<!-- x -->-- y --></url>')).toBe('<url></url>')
    }),
  ),
)
