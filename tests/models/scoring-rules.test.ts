// Every arm is scored by the same rules: a webular agent row passes the tool
// check on any webular tool (as a rival passes on any of its own), answers
// match case-insensitively, and each failed row carries one miss label.
import { expect, test } from 'bun:test'
import { Array as Arr, Option } from 'effect'
import { publicTasks } from './agent/tasks.ts'
import { evaluate, missOf, toolProblems } from './check.ts'

const ctx = { origin: 'http://127.0.0.1:1', tmp: '/t' }
const task = Option.getOrThrow(
  Arr.head(
    publicTasks(
      JSON.stringify({
        id: 'p',
        input: { question: 'Q?' },
        gold: { answers: ['Gabiley District'] },
        tags: { premise: 'none' },
      }),
    ),
  ),
)

test('a webular agent row passes the tool check on any webular tool', () => {
  expect(toolProblems(task, [{ name: 'mcp__webular__search', input: {} }], 'mcp')).toEqual([])
  expect(
    toolProblems(task, [{ name: 'mcp__plugin_webular_webular__scrape', input: {} }], 'plugin'),
  ).toEqual([])
  expect(
    toolProblems(task, [{ name: 'Bash', input: { command: 'webular search q' } }], 'cli'),
  ).toEqual([])
})

test('a webular agent row that calls no webular tool is still never-called', () => {
  expect(toolProblems(task, [], 'mcp')).toEqual(['never called a webular tool on the mcp surface'])
  expect(toolProblems(task, [{ name: 'mcp__exa__web_search_exa', input: {} }], 'mcp')).toHaveLength(
    1,
  )
})

test('answerMatches ignores case on every arm', () => {
  expect(evaluate(task.eval, 'Gabiley district', ctx)).toEqual([])
  expect(evaluate(task.eval, 'Hargeisa', ctx)).toHaveLength(1)
})

test('each failed row gets one miss label', () => {
  expect(missOf([])).toBeNull()
  expect(missOf(['timed out', 'never called a webular tool on the mcp surface'])).toBe('timeout')
  expect(missOf(['never called a exa tool on the peer surface', 'reply lacks "x"'])).toBe(
    'never-called',
  )
  expect(missOf(['reply does not match /x/'])).toBe('wrong-answer')
  expect(missOf(['skipped: no key (EXA_API_KEY)'])).toBeNull()
})
