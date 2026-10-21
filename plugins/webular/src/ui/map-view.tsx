// The map explorer: an MCP App for one map or crawl run. The URL list folds
// into a tree of the site with native disclosure; selecting a page shows its
// detail, and a filter narrows the tree by path.
import { Effect } from 'effect'
import { useState } from 'react'
import type { SessionResult } from './lifecycle.ts'
import { Frame, mount, type View } from './parts.tsx'
import { buildTree, type TreeNode } from './views.ts'

interface BranchProps {
  readonly node: TreeNode
  readonly open: boolean
  readonly onPick: (n: TreeNode) => void
}

function Leaf({ node, onPick }: Omit<BranchProps, 'open'>) {
  if (!node.url) return null
  return (
    <button type="button" className="leaf" onClick={() => onPick(node)}>
      {node.name}
      {node.outcome && <span className="tag">{node.outcome}</span>}
    </button>
  )
}

// A folder opens on its own when filtering, when it holds a failure, or when small.
function Branch({ node, open, onPick }: BranchProps) {
  const kids = [...node.children.values()]
  if (kids.length === 0)
    return (
      <li>
        <Leaf node={node} onPick={onPick} />
      </li>
    )
  const failed = node.failed > 0 ? `, ${node.failed} failed` : ''
  return (
    <li>
      <details open={open || node.failed > 0 || node.count <= 50}>
        <summary>{`${node.name}/ (${node.count}${failed})`}</summary>
        <Leaf node={node} onPick={onPick} />
        <ul>
          {kids.map((k) => (
            <Branch key={k.name} node={k} open={open} onPick={onPick} />
          ))}
        </ul>
      </details>
    </li>
  )
}

function Detail({ node, result }: { node?: TreeNode; result: SessionResult }) {
  if (!node?.url) return null
  const page = result.pages?.find((p) => p.url === node.url)
  return (
    <aside className="detail" aria-label="Page detail" aria-live="polite">
      <h2>{page?.title || node.name}</h2>
      <p>{node.outcome ?? 'Read'}</p>
      <a href={node.url} target="_blank" rel="noopener noreferrer">
        {node.url}
      </a>
    </aside>
  )
}

function Filter({
  value,
  set,
  matches,
}: {
  value: string
  set: (v: string) => void
  matches: number
}) {
  return (
    <>
      <label className="filter">
        Filter by path
        <input type="search" value={value} onChange={(e) => set(e.target.value)} />
      </label>
      {value && matches === 0 && (
        <p>
          {`No paths match "${value}". `}
          <button type="button" onClick={() => set('')}>
            Clear filter
          </button>
        </p>
      )}
    </>
  )
}

const depthOf = (urls: ReadonlyArray<string>) =>
  Math.max(0, ...urls.map((u) => (URL.parse(u)?.pathname ?? '').split('/').filter(Boolean).length))

// The filtered tree, the full count words the header shows, and the page total.
const shape = (result: SessionResult, filter: string) => {
  const urls = [...(result.links ?? []), ...(result.pages ?? []).map((p) => p.url)]
  const keep = (url: string) => url.toLowerCase().includes(filter.toLowerCase())
  const tree = buildTree(
    urls.filter(keep),
    (result.errors ?? []).filter((e) => keep(e.url)),
  )
  const all = buildTree(urls, result.errors)
  return {
    tree,
    total: all.count,
    count: `${all.count} pages, depth ${depthOf(urls)}, ${all.failed} failed`,
  }
}

const MapView: View = ({ actor, result, rerun }) => {
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<TreeNode>()
  const { tree, total, count } = shape(result, filter)
  const all = { count: total }
  const title = result.root ?? result.url ?? 'Site map'
  return (
    <Frame
      actor={actor}
      result={result}
      rerun={rerun}
      title={title}
      count={count}
      empty="No pages found."
    >
      {all.count > 0 && <Filter value={filter} set={setFilter} matches={tree.count} />}
      <div className="explorer">
        <ul className="tree" aria-label="Site tree">
          {[...tree.children.values()].map((k) => (
            <Branch key={k.name} node={k} open={filter !== ''} onPick={setPicked} />
          ))}
        </ul>
        <Detail node={picked} result={result} />
      </div>
    </Frame>
  )
}

Effect.runFork(mount(MapView))
