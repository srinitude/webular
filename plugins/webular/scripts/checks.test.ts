// Contract tests for the check scripts' pure rules, on in-memory fixtures.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { barePaths, pathSet } from './bare-paths.ts'
import { caseCount } from './check-evals.ts'
import { anchors, checkText, lineAnchorOk, slug } from './check-links.ts'
import { untested } from './check-test-first.ts'
import { findings } from './check-timeless.ts'
import { violations } from './code-limits.ts'
import { links, repoRoot } from './lib.ts'

const paths = pathSet(['src/core/cache.ts', 'docs/a.md', 'README.md'])

test('a bare repo path is flagged with its file-relative link and fixed', () => {
  const { hits, fixed } = barePaths('docs/a.md', 'See `src/core/cache.ts` and src/core/.', paths)
  expect(hits.map((h) => `${h.line} ${h.path} ${h.link}`)).toEqual([
    '1 src/core/cache.ts ../src/core/cache.ts',
    '1 src/core/ ../src/core/',
  ])
  expect(fixed).toBe(
    'See [`src/core/cache.ts`](../src/core/cache.ts) and [src/core/](../src/core/).',
  )
})

test('linked paths, fences, front matter, commands, globs, URLs, and missing examples pass', () => {
  const md = [
    '---',
    'description: uses src/core/cache.ts',
    '---',
    '[`src/core/cache.ts`](../src/core/cache.ts)',
    '```',
    'src/core/cache.ts',
    '```',
    '`mise run src/core/cache.ts`, `src/**/*.ts`, https://x.dev/src/core, `src/nope.ts`',
  ].join('\n')
  expect(barePaths('docs/a.md', md, paths).hits).toEqual([])
})

const probe = (md: string) => checkText(`${repoRoot}docs/probe.md`, md)

test('missing targets and bad line anchors fail; real files, folders, and lines pass', () =>
  Effect.gen(function* () {
    expect(yield* probe('[a](../package.json#L1-L2) [d](../src/) [e](../README.md)')).toEqual([])
    expect(yield* probe('[b](../nope.ts)\n[c](../package.json#L99999)')).toEqual([
      'docs/probe.md:1: broken link ../nope.ts',
      'docs/probe.md:2: missing line #L99999 in package.json',
    ])
    expect(lineAnchorOk('L3', 'a\nb\nc\n')).toBe(true)
    expect(lineAnchorOk('L2-L4', 'a\nb\nc\n')).toBe(false)
  }).pipe(Effect.provide(BunServices.layer), Effect.runPromise))

test('links skip fenced code and read titles', () => {
  const md = '[a](x.md "t")\n```\n[b](y.md)\n```\n[c](z.md#h)'
  expect(links(md)).toEqual([
    { line: 1, target: 'x.md' },
    { line: 5, target: 'z.md#h' },
  ])
})

test('anchors use GitHub slugs', () => {
  expect(slug('Pick the tool!')).toBe('pick-the-tool')
  expect(anchors('# One\n```\n# Hidden\n```\n## Two words').has('two-words')).toBe(true)
  expect(anchors('```\n# Hidden\n```').size).toBe(0)
})

test('timeless flags time words, versions, and dates outside code', () => {
  const kinds = findings(
    'It is now fast.\nUse `new` here.\nSee v0.2 on 2026-10-20.\n```\nnow\n```\nAsk "what is there now?"',
  ).map((f) => f.line)
  expect(kinds).toEqual([1, 3, 3])
})

test('test-first accepts a named test or an importing test', () => {
  const tests = [
    { path: '/t/a.test.ts', text: '' },
    { path: '/t/x.test.ts', text: "import {y} from '../src/b.ts'" },
  ]
  expect(untested(['/s/a.ts', '/s/b.ts', '/s/c.ts'], tests)).toHaveLength(1)
})

test('evals need three cases', () => {
  expect(caseCount({ evals: [1, 2, 3] })).toBe(3)
  expect(caseCount({})).toBe(0)
})

test('code limits flag long files, long functions, and deep nesting', () => {
  const deep = 'function f(a){ if(a){ for(;;){ while(a){ if(a){ a() } } } } }'
  expect(violations('/x/deep.ts', deep).join()).toContain('nesting depth 4')
  const long = `function g(){\n${'  1\n'.repeat(30)}}\n`
  expect(violations('/x/long.ts', long).join()).toContain('function has 32 lines')
  expect(violations('/x/big.ts', '1\n'.repeat(201)).join()).toContain(':201: file has 201 lines')
  expect(violations('/x/ok.ts', 'if (1) {} else if (2) {} else {}\n')).toEqual([])
})
