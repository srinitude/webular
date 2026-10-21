// The session view: an MCP App that renders one research or map run. The CLI's
// command lifecycle machine drives it; host notifications become its events.
import { useSelector } from '@xstate/react'
import { Effect } from 'effect'
import { createRoot } from 'react-dom/client'
import { type ActorRefFrom, createActor } from 'xstate'
import { commandLifecycleMachine } from '../../../../src/machines/command-lifecycle.ts'
import { connectHost } from './bridge.ts'
import {
  moveLabels,
  nextMoves,
  resultEvents,
  type SessionResult,
  stateLabels,
} from './lifecycle.ts'

type Lifecycle = ActorRefFrom<typeof commandLifecycleMachine>

const tones: Record<string, string> = {
  completed: 'ok',
  completedWithPartialFailures: 'warn',
  emptyWithErrors: 'bad',
  rejected: 'bad',
  failed: 'bad',
}

function Sources({ result }: { result: SessionResult }) {
  const sources = result.sources ?? (result.links ?? []).map((url) => ({ title: url, url }))
  if (sources.length === 0) return null
  return (
    <section aria-label="Sources">
      <ol>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

function SessionView({ actor, result }: { actor: Lifecycle; result: SessionResult }) {
  const snapshot = useSelector(actor, (s) => s)
  const state = String(snapshot.value)
  const moves = nextMoves(snapshot)
  const failed = result.errors?.length ?? 0
  const found = (result.sources?.length ?? 0) + (result.links?.length ?? 0)
  return (
    <>
      <h1>{result.topic ?? result.url ?? 'webular'}</h1>
      <p className="status" data-tone={tones[state]} aria-live="polite">
        {stateLabels[state]}
      </p>
      <p className="moves">
        {moves.length > 0 ? `Next: ${moves.map((m) => moveLabels[m]).join(', or ')}.` : 'Finished.'}
      </p>
      {result.message && <p role="alert">{result.message}</p>}
      {found + failed > 0 && <p>{`${found} of ${found + failed} read, ${failed} failed`}</p>}
      <Sources result={result} />
      {result.report && <article className="report">{result.report}</article>}
      <p className="moves">The agent got this same data as text.</p>
    </>
  )
}

// The page edge: one root, one actor, and one bridge fiber for the iframe's lifetime.
const root = createRoot(document.getElementById('root') ?? document.body)
const actor = createActor(commandLifecycleMachine).start()
const show = (result: SessionResult) => root.render(<SessionView actor={actor} result={result} />)
show({})
const onResult = (result: SessionResult) => {
  for (const event of resultEvents(result)) actor.send(event)
  show(result)
}
Effect.runFork(connectHost({ onStart: () => actor.send({ type: 'INPUT_VALID' }), onResult }))
