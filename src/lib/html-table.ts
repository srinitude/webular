// Turndown has no table rule; this one renders <table> as a GFM pipe table.
// A colspan cell fills its spanned columns with empty cells, a rowspan cell
// leaves an empty cell in each row below it, and every row is padded to the
// widest one so GFM drops no cell. A <caption> becomes a line above the table,
// and stacked header rows join into one header-path row.
// ponytail: a nested table's text folds into its outer cell.
import type TurndownService from 'turndown'
import { dropHidden, dropInvisible } from './html-sanitize.ts'

const flat = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

// <br> and block edges are word breaks a reader sees; textContent drops them.
// Backslashes are escaped before pipes, so a literal `\|` stays text in one cell.
const cellText = (cell: Element): string => {
  for (const br of Array.from(cell.querySelectorAll('br'))) br.replaceWith(' ')
  return flat(cell).replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

const spanOf = (cell: Element, attr: string): number =>
  Math.min(Math.max(Number.parseInt(cell.getAttribute(attr) ?? '1', 10) || 1, 1), 100)

// Places each cell in its column grid; `below[c]` holds the rows a rowspan
// cell above still covers in column c. `spread` repeats a spanned cell's text
// into every slot it covers, for header paths; otherwise those slots are empty.
const grid = (rows: Element[], spread = false): string[][] => {
  const below: { left: number; text: string }[] = []
  return rows.map((tr) => {
    const out: string[] = []
    const skipCovered = () => {
      for (let up = below[out.length]; up && up.left > 0; up = below[out.length]) {
        up.left -= 1
        out.push(spread ? up.text : '')
      }
    }
    for (const cell of Array.from(tr.children)) {
      skipCovered()
      const left = spanOf(cell, 'rowspan') - 1
      const text = cellText(cell)
      for (let i = 0; i < spanOf(cell, 'colspan'); i++) {
        below[out.length] = { left, text }
        out.push(i === 0 || spread ? text : '')
      }
    }
    skipCovered()
    return out
  })
}

const allHeader = (tr: Element): boolean =>
  tr.children.length > 0 && Array.from(tr.children).every((c) => c.tagName === 'TH')

// GFM has one header row, so stacked header rows join per column into one
// header path ("Price / 2024"), each spanned parent repeated over its columns.
const headerPaths = (heads: Element[], width: number): string[] => {
  const cells = grid(heads, true)
  return Array.from({ length: width }, (_, c) =>
    [...new Set(cells.map((r) => r[c] ?? '').filter(Boolean))].join(' / '),
  )
}

const line = (cells: string[], width: number): string =>
  `| ${[...cells, ...Array<string>(width - cells.length).fill('')].join(' | ')} |`

// Only this table's own rows: a nested table's rows belong to its cell.
const ownRows = (table: Element): Element[] =>
  Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table)

function tableToGfm(node: Element): string {
  const trs = ownRows(node)
  const rows = grid(trs)
  const stacked = trs.findIndex((tr) => !allHeader(tr))
  const width = Math.max(...rows.map((r) => r.length))
  const [head, ...body] =
    stacked > 1 ? [headerPaths(trs.slice(0, stacked), width), ...rows.slice(stacked)] : rows
  if (!head) return ''
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

type Body = Parameters<typeof dropHidden>[0]

// A data row under stacked header rows as "Header: value" pairs ("Item: Tea;
// Price / 2024: 1"), keyed by its <tr>: its bare cells lose which header path
// each value sits under. One header row stays a bare row, since that row reads
// right above it, and a second copy of each value halves its rarity weight in
// answer ranking.
// ponytail: cell text keeps grid's GFM pipe escapes ("a\|b").
const headerPairs = (body: Body): Map<Element, string> => {
  const pairs = new Map<Element, string>()
  for (const table of Array.from(body.querySelectorAll('table'))) {
    const trs = ownRows(table)
    const stacked = trs.findIndex((tr) => !allHeader(tr))
    if (stacked < 2) continue
    const rows = grid(trs)
    const heads = headerPaths(trs.slice(0, stacked), Math.max(...rows.map((r) => r.length)))
    rows.slice(stacked).forEach((cells, i) => {
      const pair = cells.flatMap((v, c) => (v && heads[c] ? [`${heads[c]}: ${v}`] : [])).join('; ')
      const tr = trs[stacked + i]
      if (pair && tr) pairs.set(tr, pair)
    })
  }
  return pairs
}

// Table rows as plain lines ("79 Au Gold."), read before Readability, which
// drops link-dense tables such as a list page's element table. Hidden rows go
// first; each row ends in a period so the answer path keeps it as a sentence.
// A data row under stacked header rows reads as its "Header: value" pairs.
export const tableRows = (body: Body): string[] => {
  dropHidden(body)
  const pairs = headerPairs(body)
  return Array.from(
    body.querySelectorAll('tr'),
    (tr) => pairs.get(tr) ?? Array.from(tr.children, (c) => c.textContent ?? '').join(' '),
  )
    .map((row) => dropInvisible(row).replace(/\s+/g, ' ').trim())
    .filter((row) => row.includes(' '))
    .map((row) => (/[.!?]$/.test(row) ? row : `${row}.`))
}
