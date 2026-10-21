// The monitor view: an MCP App for one monitor check. What changed joins the
// status line; a change shows side by side, and narrow hosts stack the two
// sides through CSS alone.
import { Effect } from 'effect'
import type { SessionResult } from './lifecycle.ts'
import { Frame, mount, type View } from './parts.tsx'
import { type DiffRow, splitDiff } from './views.ts'

const said = {
  new: 'First check, saved as the baseline',
  same: 'No change since the last check',
  changed: 'Changed, but no diff text came back',
}

const rowsOf = (result: SessionResult) =>
  result.changeStatus === 'changed' ? splitDiff(result.diff ?? '') : []

// The one status-line summary of the check.
const summary = (result: SessionResult, rows: ReadonlyArray<DiffRow>) => {
  const status = result.changeStatus
  if (!status) return undefined
  if (rows.length === 0) return said[status]
  const moved = rows.filter((r) => r.left !== r.right)
  const added = moved.filter((r) => r.right !== undefined).length
  const removed = moved.filter((r) => r.left !== undefined).length
  return `Changed: ${added} lines added, ${removed} removed`
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

function DiffTable({ rows }: { rows: ReadonlyArray<DiffRow> }) {
  if (rows.length === 0) return null
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

const MonitorView: View = (props) => {
  const { result } = props
  const rows = rowsOf(result)
  return (
    <Frame {...props} title={result.url ?? 'Page changes'} count={summary(result, rows)}>
      <DiffTable rows={rows} />
    </Frame>
  )
}

Effect.runFork(mount(MonitorView))
