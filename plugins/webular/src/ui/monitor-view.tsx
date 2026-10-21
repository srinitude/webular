// The monitor view: an MCP App for one monitor check. A change shows side by
// side; narrow hosts stack the two sides through CSS alone.
import { Effect } from 'effect'
import type { SessionResult } from './lifecycle.ts'
import { Frame, mount, type View } from './parts.tsx'
import { type DiffRow, splitDiff } from './views.ts'

const said = {
  new: 'First check, saved as the baseline.',
  same: 'No change since the last check.',
  changed: 'Changed, but no diff text came back.',
}

function Row({ row }: { row: DiffRow }) {
  const changed = row.left !== row.right
  return (
    <tr data-changed={changed}>
      <td data-side="before">
        {changed && row.left !== undefined && <span className="sr-only">Removed: </span>}
        {row.left ?? ''}
      </td>
      <td data-side="after">
        {changed && row.right !== undefined && <span className="sr-only">Added: </span>}
        {row.right ?? ''}
      </td>
    </tr>
  )
}

function Diff({ result }: { result: SessionResult }) {
  const status = result.changeStatus
  if (!status) return null
  const rows = status === 'changed' ? splitDiff(result.diff ?? '') : []
  if (rows.length === 0) return <p>{said[status]}</p>
  return (
    <table className="diff" aria-label="Changes">
      <thead>
        <tr>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff rows are positional and never reorder
          <Row key={i} row={row} />
        ))}
      </tbody>
    </table>
  )
}

const MonitorView: View = ({ actor, result, rerun }) => (
  <Frame actor={actor} result={result} rerun={rerun} title={result.url ?? 'Page changes'}>
    {result.changeStatus && (
      <p className="change" data-status={result.changeStatus}>
        {result.changeStatus}
      </p>
    )}
    <Diff result={result} />
  </Frame>
)

Effect.runFork(mount(MonitorView))
