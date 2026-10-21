// Outcome evals for the CLI features the tools pass through: scrape's archive
// flag and feed discovery from a plain page. Real server, real local site. No mocks.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { call, run } from './mcp-harness.ts'

test('scrape with archive on reads the live page and names no archive copy', () =>
  run((tools, site) =>
    call(tools, 'scrape', { url: site.href, archive: true }).pipe(
      Effect.map((result) => {
        expect(result).toContain('Webular turns web pages into clean text for agents.')
        expect(result).not.toContain('archivedFrom')
        return result
      }),
    ),
  ))

test('feed finds the feed a plain page links to and names it', () =>
  run((tools, site) =>
    call(tools, 'feed', { url: site.href }).pipe(
      Effect.map((result) => {
        expect(result).toContain('First post')
        expect(result).toContain('posts.xml')
        return result
      }),
    ),
  ))
