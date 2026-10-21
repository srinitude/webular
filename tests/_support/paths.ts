// Model-based testing: paths through a machine that end in a final state, as
// the event types that drive it there. Simple paths walk every loop-free path;
// shortest paths (for machines whose context makes simple paths explode) reach
// every distinct final state and context once.
import type { AnyStateMachine } from 'xstate'
import { getSimplePaths } from 'xstate/graph'

export interface FinalPath {
  events: string[]
  final: string
  tags: string[]
}

export function finalPaths(
  machine: AnyStateMachine,
  events: string[],
  walk: typeof getSimplePaths = getSimplePaths,
): FinalPath[] {
  const paths = walk(machine, { events: events.map((type) => ({ type })) })
  return paths
    .filter((p) => p.state.status === 'done')
    .map((p) => ({
      events: p.steps.slice(1).map((s) => s.event.type),
      final: String(p.state.value),
      tags: [...p.state.tags],
    }))
}

export function exitCodeOf(path: FinalPath): number {
  const tag = path.tags.find((t) => t.startsWith('exit-'))
  return Number(tag?.slice(5))
}
