// The session view: an MCP App for one research or answer run. The answer
// with [n] markers and the numbered sources; hovering or focusing a marker
// lights its source, and pressing it moves focus there.
import { Effect } from 'effect'
import { useState } from 'react'
import type { SessionResult } from './lifecycle.ts'
import { Frame, mount, type View } from './parts.tsx'
import { citations, outcomeLabel } from './views.ts'

const domain = (url: string) => URL.parse(url)?.host ?? url
const FOLD = 20

// Every source the run tried, read ones first, numbered the way citations count.
const sourceRows = (result: SessionResult) => [
  ...(result.sources ?? []),
  ...(result.errors ?? [])
    .filter((e) => !result.sources?.some((s) => s.url === e.url))
    .map((e) => ({ title: e.url, url: e.url })),
]

function SourceRow(props: {
  n: number
  title: string
  url: string
  outcome?: string
  active: boolean
}) {
  return (
    <li id={`source-${props.n}`} value={props.n} tabIndex={-1} data-active={props.active}>
      <a href={props.url} target="_blank" rel="noopener noreferrer">
        {props.title}
      </a>
      <span className="domain">{` ${domain(props.url)} · ${props.outcome ?? 'Read'}`}</span>
    </li>
  )
}

// Past 20 rows the list folds behind Show all, but failed rows never fold.
function Sources({ result, active }: { result: SessionResult; active?: number }) {
  const [all, setAll] = useState(false)
  const failed = new Map((result.errors ?? []).map((e) => [e.url, outcomeLabel(e.reason)]))
  const rows = sourceRows(result).map((s, i) => ({ ...s, n: i + 1, outcome: failed.get(s.url) }))
  if (rows.length === 0) return null
  const shown = rows.filter((r) => all || r.n <= FOLD || r.outcome)
  return (
    <section className="sources" aria-label="Sources">
      <h2>Sources</h2>
      <ol>
        {shown.map((r) => (
          <SourceRow key={r.url} {...r} active={active === r.n} />
        ))}
      </ol>
      {shown.length < rows.length && (
        <button type="button" onClick={() => setAll(true)}>{`Show all ${rows.length}`}</button>
      )}
    </section>
  )
}

const jump = (n: number) => {
  const row = document.getElementById(`source-${n}`)
  row?.focus()
  row?.scrollIntoView({ block: 'nearest' })
}

function Marker({
  n,
  failed,
  onActive,
}: {
  n: number
  failed: boolean
  onActive: (n?: number) => void
}) {
  return (
    <a
      className="marker"
      href={`#source-${n}`}
      aria-label={`Source ${n}${failed ? ', failed' : ''}`}
      onMouseEnter={() => onActive(n)}
      onFocus={() => onActive(n)}
      onMouseLeave={() => onActive()}
      onBlur={() => onActive()}
      onClick={(e) => {
        e.preventDefault()
        jump(n)
      }}
    >
      {`[${n}]`}
      {failed && <span className="tag">failed</span>}
    </a>
  )
}

function Answer({ result, onActive }: { result: SessionResult; onActive: (n?: number) => void }) {
  const text = result.answer ?? result.report
  if (!text) return null
  const parts = citations(text, sourceRows(result), result.errors)
  return (
    <article className="answer" aria-label="Answer">
      <h2>Answer</h2>
      <p>
        {parts.map((part, i) => {
          if (typeof part === 'string') return part
          if (part.missing) return `[${part.n}]`
          // biome-ignore lint/suspicious/noArrayIndexKey: answer parts are positional and never reorder
          return <Marker key={i} n={part.n} failed={part.failed} onActive={onActive} />
        })}
      </p>
    </article>
  )
}

const SessionView: View = ({ actor, result, rerun }) => {
  const [active, setActive] = useState<number>()
  const title = result.topic ?? result.query ?? 'Research'
  return (
    <Frame actor={actor} result={result} rerun={rerun} title={title} empty="Nothing found.">
      <div className="columns">
        <Answer result={result} onActive={setActive} />
        <Sources result={result} active={active} />
      </div>
    </Frame>
  )
}

Effect.runFork(mount(SessionView))
