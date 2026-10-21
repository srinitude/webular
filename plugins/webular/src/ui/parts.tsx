// What every view shares: the header with the three-step strip and plain next
// moves, Re-run and Copy as text on a final state, the same-data footer, and
// the page edge that wires one actor and one bridge fiber to a view.
import { useSelector } from '@xstate/react'
import { type ReactNode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { type ActorRefFrom, createActor, type SnapshotFrom } from 'xstate'
import { commandLifecycleMachine } from '../../../../src/machines/command-lifecycle.ts'
import { type Copy, connectHost } from './bridge.ts'
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
      {steps.map(([s, label, doneLabel], i) => (
        <li
          key={s}
          data-done={i < reached}
          data-bad={i === stop}
          data-warn={i === 1 && state === 'completedWithPartialFailures'}
          aria-current={i === at && stop === undefined ? 'step' : undefined}
        >
          {i < reached ? doneLabel : label}
          {i === stop && <span className="sr-only"> (stopped here)</span>}
        </li>
      ))}
    </ol>
  )
}

// When the result came back (Effect clock, ms), and how long the run took when the view saw it start.
export interface Timing {
  readonly at: number
  readonly took?: number | undefined
}

export interface Props {
  readonly result: SessionResult
  readonly rerun?: () => void
  readonly copy?: Copy
  readonly timing?: Timing | undefined
}

const copyLabels = { idle: 'Copy as text', done: 'Copied', failed: 'Copy failed, try again' }

function Actions({ snapshot, result, rerun, copy }: Props & { snapshot: Snapshot }) {
  const [copied, setCopied] = useState<keyof typeof copyLabels>('idle')
  if (snapshot.status !== 'done') return null
  const onCopy = () => copy?.(asText(snapshot, result), (ok) => setCopied(ok ? 'done' : 'failed'))
  return (
    <p className="actions">
      {rerun && (
        <button type="button" onClick={rerun}>
          Re-run
        </button>
      )}
      {copy && (
        <button type="button" onClick={onCopy} data-copy={copied}>
          {copyLabels[copied]}
        </button>
      )}
      <span role="status" className="sr-only">
        {copied === 'idle' ? '' : copyLabels[copied]}
      </span>
    </p>
  )
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const when = ({ at, took }: Timing) =>
  [`Checked ${clock(at)}`, took === undefined ? '' : `took ${(took / 1000).toFixed(1)} s`]
    .filter(Boolean)
    .join(', ')

// Where the run is, its cause when it failed, and what the machine can still reach.
function Status({
  snapshot,
  result,
  count,
  timing,
}: Props & { snapshot: Snapshot; count?: string | undefined }) {
  const state = String(snapshot.value)
  const moves = nextMoves(snapshot)
  const { found, failed, words } = coverage(result)
  const counted = count ?? (found + failed > 0 ? words : undefined)
  return (
    <>
      <p className="status" data-tone={tones[state]} aria-live="polite">
        {stateLabels[state]}
        {counted && <span className="count">{counted}</span>}
      </p>
      {timing && snapshot.status === 'done' && <p className="when">{when(timing)}</p>}
      {result.message && <p role="alert">{result.message}</p>}
      {moves.length > 0 && (
        <p className="moves">{`Next: ${moves.map((m) => moveLabels[m]).join(', or ')}.`}</p>
      )}
    </>
  )
}

// The frame around a view's body: what ran, where it is, and what comes next.
// `count` replaces the shared "x of y read" words, and shows even when nothing was read; `empty` is what a finished
// run with nothing to show says.
export function Frame(
  props: Props & {
    actor: Lifecycle
    title: string
    count?: string | undefined
    empty?: string
    children: ReactNode
  },
) {
  const { actor, result, title, count, empty, children, timing } = props
  const snapshot = useSelector(actor, (s) => s)
  const state = String(snapshot.value)
  const running = snapshot.status !== 'done' && state !== 'validatingInput'
  const nothing = state === 'completed' && coverage(result).found === 0 && empty
  return (
    <>
      <header>
        <h1>{title}</h1>
        <Strip state={state} />
        <Status snapshot={snapshot} result={result} count={count} timing={timing} />
        <Actions snapshot={snapshot} {...props} />
      </header>
      {running && <p className="moves">Reading sources…</p>}
      {nothing ? <p>{empty}</p> : children}
      <footer className="moves">The agent got this same data as text.</footer>
    </>
  )
}

export type View = (props: Props & { actor: Lifecycle }) => ReactNode

// The page edge: one root, one actor per run, and the bridge Effect the view file runs once.
// onStart takes the input as valid; a rejected result replays on a fresh actor so it can land.
export const mount = (View: View) => {
  const root = createRoot(document.getElementById('root') ?? document.body)
  let actor = createActor(commandLifecycleMachine).start()
  const state: { props: Props; startedAt?: number | undefined } = { props: { result: {} } }
  const show = (next: Partial<Props>) => {
    state.props = { ...state.props, ...next }
    root.render(<View actor={actor} {...state.props} />)
  }
  show({})
  const onStart = (at: number) => {
    if (actor.getSnapshot().status === 'done') actor = createActor(commandLifecycleMachine).start()
    if (actor.getSnapshot().can({ type: 'INPUT_VALID' })) actor.send({ type: 'INPUT_VALID' })
    state.startedAt = at
    show({ result: {}, timing: undefined })
  }
  const onResult = (result: SessionResult, at: number) => {
    const events = resultEvents(result)
    if (events[0]?.type === 'INPUT_INVALID') actor = createActor(commandLifecycleMachine).start()
    for (const event of events) if (actor.getSnapshot().can(event)) actor.send(event)
    const { startedAt } = state
    state.startedAt = undefined
    show({ result, timing: { at, took: startedAt === undefined ? undefined : at - startedAt } })
  }
  return connectHost({
    onStart,
    onResult,
    onRerunReady: (rerun) => show({ rerun }),
    onCopyReady: (copy) => show({ copy }),
  })
}
