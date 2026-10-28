// Guard: the MCP App views are gone for good. Every tool answers as text and
// structured data; this fails if a ui:// resource or the views folder returns.

import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const SELF = 'tests/quality/no-mcp-apps.test.ts'
// The Fumadocs docs site is a Next.js app, so its pages are .tsx; no other file may be.
const isView = (f: string) => /\.(tsx|jsx)$/.test(f) && !f.startsWith('site-docs/')

describe('no MCP App views come back', () => {
  test('only the docs site may hold .tsx or .jsx files', () => {
    const files = ['site-docs/app/layout.tsx', 'src/ui/view.tsx', 'site-docs-x/a.jsx', 'src/a.ts']
    expect(files.filter(isView)).toEqual(['src/ui/view.tsx', 'site-docs-x/a.jsx'])
  })

  test(
    'plugins/webular/src/ui does not exist',
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        expect(yield* fs.exists(`${ROOT}plugins/webular/src/ui`)).toBe(false)
      }),
    ),
  )

  test(
    'no file in the repo names a ui:// resource or a view file',
    eff(
      Effect.gen(function* () {
        const grep = yield* runProc(
          ['git', 'grep', '-l', '-I', '--untracked', '-F', 'ui://', '--', '.', `:!${SELF}`],
          { timeoutMs: 20_000, cwd: ROOT },
        )
        expect(grep.stdout.split('\n').filter(Boolean)).toEqual([])
        const files = yield* runProc(
          ['git', 'ls-files', '--cached', '--others', '--exclude-standard'],
          {
            timeoutMs: 10_000,
            cwd: ROOT,
          },
        )
        expect(files.stdout.split('\n').filter(isView)).toEqual([])
      }),
    ),
    30_000,
  )
})
