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
    .map((e) => ({ title: 'Page not read', url: e.url })),
]

// One name per failed source, the same in the answer and the source list.
const outcomes = (result: SessionResult) =>
  new Map((result.errors ?? []).map((e) => [e.url, outcomeLabel(e.reason)]))

function SourceRow(props: {
  n: number
  title: string
  url: string
  outcome?: string
  active: boolean
}) {
  return (
    <li id={`source-${props.n}`} value={props.n} tabIndex={-1} data-active={props.active}>
      {props.outcome ? (
        props.title
      ) : (
        <a href={props.url} target="_blank" rel="noopener noreferrer">
          {props.title}
        </a>
      )}
      <span className="domain">{` ${domain(props.url)} · ${props.outcome ?? 'Read'}`}</span>
    </li>
  )
}

// Past 20 rows the list folds behind Show all, but failed rows never fold.
function Sources({ result, active }: { result: SessionResult; active?: number }) {
  const [all, setAll] = useState(false)
  const failed = outcomes(result)
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
  outcome,
  onActive,
}: {
  n: number
  outcome?: string
  onActive: (n?: number) => void
}) {
  return (
    <a
      className="marker"
      href={`#source-${n}`}
      aria-label={`Source ${n}${outcome ? `, ${outcome}` : ''}`}
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
      {outcome && <span className="tag">{outcome}</span>}
    </a>
  )
}

function Answer({ result, onActive }: { result: SessionResult; onActive: (n?: number) => void }) {
  const text = result.answer ?? result.report
  if (!text) return null
  const rows = sourceRows(result)
  const failed = outcomes(result)
  const parts = citations(text, rows, result.errors)
  // A marker sits right after its word, as footnotes do.
  const tight = (i: number) => {
    const next = parts[i + 1]
    return typeof next === 'object' && !next.missing
  }
  return (
    <article className="answer" aria-label="Answer">
      <h2>Answer</h2>
      <p>
        {parts.map((part, i) => {
          if (typeof part === 'string') return tight(i) ? part.trimEnd() : part
          if (part.missing) return `[${part.n}]`
          const outcome = failed.get(rows[part.n - 1]?.url ?? '')
          // biome-ignore lint/suspicious/noArrayIndexKey: answer parts are positional and never reorder
          return <Marker key={i} n={part.n} outcome={outcome} onActive={onActive} />
        })}
      </p>
    </article>
  )
}

const SessionView: View = (props) => {
  const { result } = props
  const [active, setActive] = useState<number>()
  const title = result.topic ?? result.query ?? 'Research'
  return (
    <Frame {...props} title={title} empty="Nothing found.">
      <div className="columns">
        <Answer result={result} onActive={setActive} />
        <Sources result={result} active={active} />
      </div>
    </Frame>
  )
}

Effect.runFork(mount(SessionView))
