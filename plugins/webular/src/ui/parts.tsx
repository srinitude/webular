// What every view shares: the header with the three-step strip and plain next
// moves, Re-run and Copy as text on a final state, the same-data footer, and
// the page edge that wires one actor and one bridge fiber to a view.
import { useSelector } from '@xstate/react'
import { type ReactNode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { type ActorRefFrom, createActor, type SnapshotFrom } from 'xstate'
import { commandLifecycleMachine } from '../../../../src/machines/command-lifecycle.ts'
import { connectHost } from './bridge.ts'
import {
  asText,
  coverage,
  moveLabels,
  nextMoves,
  resultEvents,
  type SessionResult,
  stateLabels,
  steps,
} from './lifecycle.ts'

type Lifecycle = ActorRefFrom<typeof commandLifecycleMachine>
export type Snapshot = SnapshotFrom<typeof commandLifecycleMachine>

const tones: Record<string, string> = {
  completed: 'ok',
  completedWithPartialFailures: 'warn',
  emptyWithErrors: 'bad',
  rejected: 'bad',
  failed: 'bad',
}

// The step a run stopped at: rejected stops while checking input, failed while running.
const stoppedAt: Record<string, number> = { rejected: 0, failed: 1 }

function Strip({ state }: { state: string }) {
  const stop = stoppedAt[state]
  const at = stop ?? steps.findIndex(([s]) => s === state)
  const reached = at === -1 ? steps.length : at
  return (
    <ol className="strip" aria-label="Steps">
      {steps.map(([s, label], i) => (
        <li
          key={s}
          data-done={i < reached}
          data-bad={i === stop}
          aria-current={i === at && stop === undefined ? 'step' : undefined}
        >
          {label}
          {i < reached && <span className="sr-only"> (done)</span>}
          {i === stop && <span className="sr-only"> (stopped here)</span>}
        </li>
      ))}
    </ol>
  )
}

export interface Props {
  readonly result: SessionResult
  readonly rerun?: () => void
}

function Actions({ snapshot, result, rerun }: Props & { snapshot: Snapshot }) {
  const [copied, setCopied] = useState(false)
  if (snapshot.status !== 'done') return null
  // ponytail: marks Copied once the write is asked for; show a failure when a host denies clipboard.
  const copy = () => {
    navigator.clipboard.writeText(asText(snapshot, result))
    setCopied(true)
  }
  return (
    <p className="actions">
      {rerun && (
        <button type="button" onClick={rerun}>
          Re-run
        </button>
      )}
      <button type="button" onClick={copy}>
        {copied ? 'Copied' : 'Copy as text'}
      </button>
    </p>
  )
}

// Where the run is, its cause when it failed, and what the machine can still reach.
function Status({
  snapshot,
  result,
  count,
}: {
  snapshot: Snapshot
  result: SessionResult
  count?: string
}) {
  const state = String(snapshot.value)
  const moves = nextMoves(snapshot)
  const { found, failed, words } = coverage(result)
  return (
    <>
      <p className="status" data-tone={tones[state]} aria-live="polite">
        {stateLabels[state]}
        {found + failed > 0 && <span className="count">{` · ${count ?? words}`}</span>}
      </p>
      {result.message && <p role="alert">{result.message}</p>}
      {moves.length > 0 && (
        <p className="moves">{`Next: ${moves.map((m) => moveLabels[m]).join(', or ')}.`}</p>
      )}
    </>
  )
}

// The frame around a view's body: what ran, where it is, and what comes next.
// `count` replaces the shared "x of y read" words; `empty` is what a finished
// run with nothing to show says.
export function Frame(
  props: Props & {
    actor: Lifecycle
    title: string
    count?: string
    empty?: string
    children: ReactNode
  },
) {
  const { actor, result, rerun, title, count, empty, children } = props
  const snapshot = useSelector(actor, (s) => s)
  const state = String(snapshot.value)
  const running = snapshot.status !== 'done' && state !== 'validatingInput'
  const nothing = state === 'completed' && coverage(result).found === 0 && empty
  return (
    <>
      <header>
        <h1>{title}</h1>
        <Strip state={state} />
        <Status snapshot={snapshot} result={result} count={count} />
        <Actions snapshot={snapshot} result={result} rerun={rerun} />
      </header>
      {running && <p className="moves">Reading sources…</p>}
      {nothing ? <p>{empty}</p> : children}
      <footer className="moves">The agent got this same data as text.</footer>
    </>
  )
}

export type View = (props: Props & { actor: Lifecycle }) => ReactNode

// The page edge: one root, one actor per run, and the bridge Effect the view file runs once.
export const mount = (View: View) => {
  const root = createRoot(document.getElementById('root') ?? document.body)
  let actor = createActor(commandLifecycleMachine).start()
  let props: Props = { result: {} }
  const show = (next: Partial<Props>) => {
    props = { ...props, ...next }
    root.render(<View actor={actor} {...props} />)
  }
  show({})
  const onStart = () => {
    if (actor.getSnapshot().status === 'done') actor = createActor(commandLifecycleMachine).start()
    if (actor.getSnapshot().can({ type: 'INPUT_VALID' })) actor.send({ type: 'INPUT_VALID' })
    show({ result: {} })
  }
  const onResult = (result: SessionResult) => {
    for (const event of resultEvents(result)) if (actor.getSnapshot().can(event)) actor.send(event)
    show({ result })
  }
  return connectHost({ onStart, onResult, onRerunReady: (rerun) => show({ rerun }) })
}
