// Contract tests for the check scripts' pure rules, on in-memory fixtures.
import { expect, test } from 'bun:test'
import { caseCount } from './check-evals.ts'
import { anchors, slug } from './check-links.ts'
import { untested } from './check-test-first.ts'
import { findings } from './check-timeless.ts'
import { violations } from './code-limits.ts'
import { links } from './lib.ts'

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
