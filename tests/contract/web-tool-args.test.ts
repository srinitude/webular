// The web.* MCP tools refuse a non-web URL scheme (file:, javascript:) and an
// unknown argument before any work runs, instead of fetching or dropping it.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { webTools } from '../../src/tools/web.ts'
import { eff } from '../_support/run.ts'

const tagOf = (id: string, args: Record<string, unknown>) =>
  Effect.fromNullishOr(webTools.find((t) => t.id === id)).pipe(
    Effect.flatMap((tool) => tool.run(args)),
    Effect.match({ onFailure: (e) => (e as { _tag?: string })._tag, onSuccess: () => 'ok' }),
  )

test(
  'web tools accept only http and https URLs',
  eff(
    Effect.gen(function* () {
      expect(yield* tagOf('web.fetch', { url: 'file:///etc/passwd' })).toBe('ToolArgsError')
      expect(yield* tagOf('web.links', { html: '', base: 'javascript:alert(1)' })).toBe(
        'ToolArgsError',
      )
      expect(
        yield* tagOf('web.links', { html: '<a href="/a">a</a>', base: 'https://x.test/' }),
      ).toBe('ok')
    }),
  ),
)

test(
  'web tools reject unknown arguments',
  eff(
    Effect.gen(function* () {
      expect(yield* tagOf('web.markdown', { html: '<p>x</p>', extra: 1 })).toBe('ToolArgsError')
      expect(yield* tagOf('web.markdown', { html: '<p>x</p>' })).toBe('ok')
    }),
  ),
)
