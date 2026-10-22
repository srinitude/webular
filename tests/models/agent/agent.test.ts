// The agent track's grid, arm tools, arm order, task set, cost, and pass^k,
// with no model call.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { jobsFor } from '../jobs.ts'
import { withPassK } from '../report.ts'
import { loadScenarios, type ScenarioFile } from '../scenarios.ts'
import { allowedTools, peerServer } from './arm.ts'
import { costUsd } from './rates.ts'
import { publicTasks } from './tasks.ts'

const withFile = (f: (file: ScenarioFile) => void) =>
  Effect.runPromise(Effect.map(loadScenarios, f).pipe(Effect.provide(BunServices.layer)))

test('a peer arm runs once per provider, allows only its own server, and names the provider in its path', () =>
  withFile((file) => {
    const jobs = jobsFor(file, 'agent', false, { surfaces: 'peer', models: 'claude-haiku-5-5' })
    expect(new Set(jobs.map((j) => j.provider)).size).toBe(file.providers?.length ?? 0)
    expect(jobs.some((j) => /claude-haiku-5-5-peer-exa-/.test(j.rawPath))).toBe(true)
    expect(allowedTools('peer', 'exa')).toEqual(['mcp__exa'])
  }))

test('the peer config names keys by env var, never by value', () =>
  withFile((file) => {
    const exa = file.providers?.find((p) => p.id === 'exa')
    expect(exa && JSON.stringify(peerServer(exa))).toContain(`\${EXA_API_KEY}`)
  }))

test('every npx peer server is pinned to an exact version', () =>
  withFile((file) => {
    const npx = (file.providers ?? []).filter((p) => p.command === 'npx')
    expect(npx.length).toBeGreaterThan(0)
    for (const p of npx) expect(p.args.at(-1)).toMatch(/.@\d+\.\d+\.\d+$/)
  }))

test('arm order is random per task, and the same seed repeats it', () =>
  withFile((file) => {
    const order = (seed: string) =>
      jobsFor(file, 'agent', false, { surfaces: 'cli,mcp,peer', models: 'claude-opus-5-5', seed })
        .filter((j) => j.s.id === file.smoke)
        .map((j) => j.provider + j.surface)
    expect(order('a')).toEqual(order('a'))
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => order(s).join())
    expect(new Set(seeds).size).toBeGreaterThan(1)
    expect(jobsFor(file, 'agent', false, { seed: 'z' })[0]?.seed).toBe('z')
  }))

test('public tasks keep single-answer, no-premise questions and skip the canary line', () => {
  const row = (id: string, premise: string, answers: string[]) =>
    JSON.stringify({ id, input: { question: `Q ${id}?` }, gold: { answers }, tags: { premise } })
  const tasks = publicTasks(
    [
      JSON.stringify({ canary: 'x' }),
      row('a', 'none', ['A.B']),
      row('b', 'false', ['B']),
      row('c', 'none', ['C', 'D']),
    ].join('\n'),
  )
  expect(tasks.map((t) => t.id)).toEqual(['a'])
  expect(tasks[0]?.eval.answerMatches).toBe('A\\.B')
})

test('a public task matches its gold or any alias, literally', () => {
  const line = JSON.stringify({
    id: 'p',
    input: { question: 'Q?' },
    gold: { answers: ['8,586 m'] },
    aliases: ['8,586 m', '8586 m'],
    tags: { premise: 'none' },
  })
  expect(publicTasks(line)[0]?.eval.answerMatches).toBe('8,586 m|8586 m')
})

test('cost uses the public rate, and an unknown model has no cost', () => {
  const u = { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0 }
  expect(costUsd('claude-sonnet-5-5', u)).toBe(12)
  expect(costUsd('other', u)).toBeNull()
})

test('pass^k holds only when every repeat passed', () => {
  const row = {
    model: 'm',
    surface: 'cli',
    provider: 'webular',
    task: 's',
    problems: [],
    turns: 1,
    wallMs: 1,
  }
  const rows = withPassK(
    [
      { ...row, pass: true },
      { ...row, pass: false },
    ],
    2,
  )
  expect(rows).toMatchObject([{ passK: { k: 2, pass: false } }, { passK: { k: 2, pass: false } }])
  expect(withPassK([{ ...row, pass: true }], 1)).toEqual([{ ...row, pass: true }])
})
