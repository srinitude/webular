// Turndown has no table rule; this one renders <table> as a GFM pipe table.
// ponytail: colspan, rowspan, and nested tables get no special handling.
import type TurndownService from 'turndown'

const cellText = (cell: Element): string =>
  (cell.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')

const line = (cells: string[]): string => `| ${cells.join(' | ')} |`

function tableToGfm(node: Element): string {
  const rows = Array.from(node.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.children).map(cellText),
  )
  const [head, ...body] = rows
  if (!head) return ''
  return `\n\n${[line(head), line(head.map(() => '---')), ...body.map(line)].join('\n')}\n\n`
}

export function addTableRule(service: TurndownService): void {
  service.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => tableToGfm(node as Element),
  })
}
