// Turndown has no table rule; this one renders <table> as a GFM pipe table.
// A colspan cell fills its spanned columns with empty cells, and every row is
// padded to the widest one so GFM drops no cell.
// ponytail: rowspan gets no special handling, and a nested table's text folds
// into its outer cell.
import type TurndownService from 'turndown'

// <br> and block edges are word breaks a reader sees; textContent drops them.
const cellText = (cell: Element): string => {
  for (const br of Array.from(cell.querySelectorAll('br'))) br.replaceWith(' ')
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
}

const span = (cell: Element): number =>
  Math.min(Math.max(Number.parseInt(cell.getAttribute('colspan') ?? '1', 10) || 1, 1), 100)

const rowCells = (tr: Element): string[] =>
  Array.from(tr.children).flatMap((cell) => [
    cellText(cell),
    ...Array<string>(span(cell) - 1).fill(''),
  ])

const line = (cells: string[], width: number): string =>
  `| ${[...cells, ...Array<string>(width - cells.length).fill('')].join(' | ')} |`

function tableToGfm(node: Element): string {
  // Only this table's own rows: a nested table's rows belong to its cell.
  const rows = Array.from(node.querySelectorAll('tr'))
    .filter((tr) => tr.closest('table') === node)
    .map(rowCells)
  const [head, ...body] = rows
  if (!head) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const rule = Array<string>(width).fill('---')
  return `\n\n${[line(head, width), line(rule, width), ...body.map((r) => line(r, width))].join('\n')}\n\n`
}

export function addTableRule(service: TurndownService): void {
  service.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => tableToGfm(node as Element),
  })
}
