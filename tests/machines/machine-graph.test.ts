// Static graph check on every machine (Agentproof, arXiv 2603.20356): each state
// is reachable from the initial state, and each state that is not final has a
// way out. A dead end or an orphaned state fails here before any code runs.
import { expect, test } from 'bun:test'
import type { AnyStateMachine, AnyStateNode } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { cliDispatchMachine } from '../../src/machines/cli-dispatch.ts'
import { commandLifecycleMachine } from '../../src/machines/command-lifecycle.ts'
import { fetchMachine } from '../../src/machines/fetch.ts'
import { jevCommandMachine } from '../../src/machines/jev-command.ts'
import { mcpServeMachine } from '../../src/machines/mcp-serve.ts'
import { scrapeFallbackMachine } from '../../src/machines/scrape-fallback.ts'

const MACHINES: Record<string, AnyStateMachine> = {
  cliDispatch: cliDispatchMachine,
  commandLifecycle: commandLifecycleMachine,
  fetch: fetchMachine,
  jevCommand: jevCommandMachine,
  mcpServe: mcpServeMachine,
  scrapeFallback: scrapeFallbackMachine,
}

const children = (node: AnyStateNode): AnyStateNode[] => Object.values(node.states)
const leaves = (node: AnyStateNode): AnyStateNode[] =>
  children(node).length === 0 ? [node] : children(node).flatMap(leaves)
// A state is left through its own transitions or any ancestor's.
const chain = (node: AnyStateNode): AnyStateNode[] =>
  node.parent === undefined ? [node] : [node, ...chain(node.parent)]
const outgoing = (node: AnyStateNode) =>
  chain(node).flatMap((n) => [
    ...[...n.transitions.values()].flat(),
    ...(n.always ?? []),
    ...(n.after ?? []),
  ])
// Entering a compound state enters its initial child, down to a leaf.
const enter = (node: AnyStateNode): AnyStateNode[] =>
  children(node).length === 0 ? [node] : (node.initial.target ?? []).flatMap(enter)

const reachable = (machine: AnyStateMachine) => {
  const seen = new Set<AnyStateNode>()
  const visit = (node: AnyStateNode): void => {
    if (seen.has(node)) return
    seen.add(node)
    for (const t of outgoing(node))
      for (const target of t.target ?? []) enter(target).forEach(visit)
  }
  enter(machine.root).forEach(visit)
  // A transition function picks its target when it runs, so it has no static
  // target. Machines with one also run under xstate/graph: every state a
  // shortest path reaches counts, and the static walk continues from it.
  if (leaves(machine.root).some((n) => outgoing(n).some((t) => t.to)))
    for (const path of getShortestPaths(machine))
      path.state.nodes.filter((n: AnyStateNode) => children(n).length === 0).forEach(visit)
  return seen
}

for (const [name, machine] of Object.entries(MACHINES)) {
  test(`${name}: every state is reachable and every non-final state has an exit`, () => {
    const seen = reachable(machine)
    const orphans = leaves(machine.root).filter((n) => !seen.has(n))
    expect(orphans.map((n) => n.id)).toEqual([])
    const deadEnds = [...seen].filter((n) => n.type !== 'final' && outgoing(n).length === 0)
    expect(deadEnds.map((n) => n.id)).toEqual([])
  })
}
