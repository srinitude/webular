// Test support: load the real mise task graph from mise.toml and reason about it.
// Used by the CI/CD contract tests. Bun parses TOML imports natively.
import mise from '../../mise.toml'

export type Task = { depends?: string[]; run?: string; description?: string }
export type Graph = Record<string, Task>

export function loadGraph(): Graph {
  return ((mise as { tasks?: Graph }).tasks ?? {}) as Graph
}

export function parentsOf(graph: Graph, name: string): string[] {
  return graph[name]?.depends ?? []
}

function walk(node: string, g: Graph, seen: Set<string>, stack: Set<string>): boolean {
  if (stack.has(node)) return true
  if (seen.has(node)) return false
  seen.add(node)
  stack.add(node)
  const cyclic = parentsOf(g, node).some((dep) => walk(dep, g, seen, stack))
  stack.delete(node)
  return cyclic
}

export function hasCycle(graph: Graph): boolean {
  const seen = new Set<string>()
  return Object.keys(graph).some((node) => walk(node, graph, seen, new Set<string>()))
}
