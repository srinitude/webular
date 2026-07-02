// CI/CD contract: the universal mise task graph that every CLI invocation
// routes through. Tests the real mise.toml — not implementation details.
import { describe, expect, test } from 'bun:test'
import { hasCycle, loadGraph, parentsOf } from '../_support/graph.ts'

const SPINE = ['setup', 'lint', 'typecheck', 'build', 'test', 'validate', 'ci']
const COMMANDS = [
  'search',
  'scrape',
  'crawl',
  'map',
  'extract',
  'summarize',
  'answer',
  'research',
  'parse',
  'media',
  'monitor',
  'batch',
  'doctor',
  'tasks',
  'mcp',
  'diagram',
  'audit',
  'act',
]
const graph = loadGraph()

describe('mise task graph — the contract every CLI invocation routes through', () => {
  test('defines the full quality + CI spine', () => {
    for (const name of SPINE) expect(graph[name]).toBeDefined()
  })

  test('CI spine is a single linear default dependency path', () => {
    for (let i = 1; i < SPINE.length; i++) {
      const task = SPINE[i] as string
      const parent = SPINE[i - 1] as string
      expect(parentsOf(graph, task)).toEqual([parent])
    }
  })

  test('setup is the single root with no predecessor', () => {
    expect(parentsOf(graph, 'setup')).toEqual([])
  })

  test('format is a mutating dev task OFF the check-only CI spine', () => {
    expect(graph.format).toBeDefined()
    expect(parentsOf(graph, 'format')).toEqual(['setup'])
    for (const name of SPINE) expect(parentsOf(graph, name)).not.toContain('format')
  })

  test('every capability command depends on exactly one predecessor: setup', () => {
    for (const cmd of COMMANDS) expect(parentsOf(graph, `run:${cmd}`)).toEqual(['setup'])
  })

  test('the universal task graph is acyclic', () => {
    expect(hasCycle(graph)).toBe(false)
  })
})
