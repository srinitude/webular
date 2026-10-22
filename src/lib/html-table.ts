// Turndown has no table rule; this one renders <table> as a GFM pipe table.
// A colspan cell fills its spanned columns with empty cells, a rowspan cell
// leaves an empty cell in each row below it, and every row is padded to the
// widest one so GFM drops no cell. A <caption> becomes a line above the table.
// ponytail: a nested table's text folds into its outer cell.
import type TurndownService from 'turndown'

const flat = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

// <br> and block edges are word breaks a reader sees; textContent drops them.
// Backslashes are escaped before pipes, so a literal `\|` stays text in one cell.
const cellText = (cell: Element): string => {
  for (const br of Array.from(cell.querySelectorAll('br'))) br.replaceWith(' ')
  return flat(cell).replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

const spanOf = (cell: Element, attr: string): number =>
  Math.min(Math.max(Number.parseInt(cell.getAttribute(attr) ?? '1', 10) || 1, 1), 100)

// Places each cell in its column grid; `below[c]` counts the rows a rowspan
// cell above still covers in column c.
const grid = (rows: Element[]): string[][] => {
  const below: number[] = []
  return rows.map((tr) => {
    const out: string[] = []
    const skipCovered = () => {
      for (let left = below[out.length] ?? 0; left > 0; left = below[out.length] ?? 0) {
        below[out.length] = left - 1
        out.push('')
      }
    }
    for (const cell of Array.from(tr.children)) {
      skipCovered()
      const down = spanOf(cell, 'rowspan') - 1
      const text = cellText(cell)
      for (let i = 0; i < spanOf(cell, 'colspan'); i++) {
        below[out.length] = down
        out.push(i === 0 ? text : '')
      }
    }
    skipCovered()
    return out
  })
}

const line = (cells: string[], width: number): string =>
  `| ${[...cells, ...Array<string>(width - cells.length).fill('')].join(' | ')} |`

function tableToGfm(node: Element): string {
  // Only this table's own rows: a nested table's rows belong to its cell.
  const rows = grid(
    Array.from(node.querySelectorAll('tr')).filter((tr) => tr.closest('table') === node),
  )
  const [head, ...body] = rows
  if (!head) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const rule = Array<string>(width).fill('---')
  const caption = Array.from(node.children).find((c) => c.tagName === 'CAPTION')
  const title = caption ? flat(caption) : ''
  const table = [line(head, width), line(rule, width), ...body.map((r) => line(r, width))]
  return `\n\n${title ? `${title}\n\n` : ''}${table.join('\n')}\n\n`
}

export function addTableRule(service: TurndownService): void {
  service.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => tableToGfm(node as Element),
  })
}
