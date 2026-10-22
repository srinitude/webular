// PDF page layout from pdf.js text items alone, no model: a recursive XY-Cut
// reading order (Ha et al. 1995; arXiv 2504.10258 and 2509.11720 use it as the
// layout baseline) and a per-page quality flag from simple ratios (arXiv 2505.01435
// escalates poor pages). Pure functions on plain items, so tests need no PDF.

export type TextItem = {
  str: string
  hasEOL: boolean
  width: number
  height: number
  transform: number[]
}

type Box = { it: TextItem; i: number; x0: number; x1: number; y0: number; y1: number }

// A blank item (a space) gets zero extent so it never bridges a column gutter.
const box = (it: TextItem, i: number): Box => {
  const [x, y] = [it.transform[4] ?? 0, it.transform[5] ?? 0]
  const blank = it.str.trim() === ''
  const h = blank ? 0 : it.height || Math.abs(it.transform[3] ?? 0)
  return { it, i, x0: x, x1: blank ? x : x + it.width, y0: y, y1: y + h }
}

// Boxes sorted by `lo` fall into a new group when the next `lo` clears the
// running `hi` by at least `gap`.
const split = (bs: Box[], lo: (b: Box) => number, hi: (b: Box) => number, gap: number) => {
  const groups: Box[][] = []
  let end = Number.NEGATIVE_INFINITY
  for (const b of [...bs].sort((a, c) => lo(a) - lo(c))) {
    if (groups.length > 0 && lo(b) - end < gap) {
      groups.at(-1)?.push(b)
      end = Math.max(end, hi(b))
    } else {
      groups.push([b])
      end = hi(b)
    }
  }
  return groups
}

const rowsOf = (bs: Box[]) =>
  split(
    bs,
    (b) => -b.y1,
    (b) => -b.y0,
    0,
  )

const lineText = (bs: Box[]) =>
  [...bs]
    .sort((a, b) => a.i - b.i)
    .map((b) => b.it.str + (b.it.hasEOL ? '\n' : ''))
    .join('')

const joined = (parts: string[]) =>
  parts.reduce((acc, p) => acc + (acc && !acc.endsWith('\n') ? '\n' : '') + p, '')

// One visual line stays in stream order. A multi-line block splits at a vertical
// gutter (columns, left to right); with none it splits at its widest line gap
// (top to bottom), so a title above two columns reads first, then the columns.
// ponytail: recursion re-sorts per level, quadratic in lines per page.
const cut = (bs: Box[], gutter: number): string => {
  const rows = rowsOf(bs)
  if (rows.length < 2) return lineText(bs)
  const cols = split(
    bs,
    (b) => b.x0,
    (b) => b.x1,
    gutter,
  )
  if (cols.length > 1) return joined(cols.map((g) => cut(g, gutter)))
  const gaps = rows
    .slice(1)
    .map((r, k) => Math.min(...(rows[k] ?? []).map((b) => b.y0)) - Math.max(...r.map((b) => b.y1)))
  const at = gaps.indexOf(Math.max(...gaps)) + 1
  return joined([rows.slice(0, at), rows.slice(at)].map((g) => cut(g.flat(), gutter)))
}

// ponytail: gutter of 1.2 median item heights, unmeasured; tune on a dev set.
export const columnText = (items: TextItem[]) => {
  const bs = items.map(box)
  const hs = bs
    .map((b) => b.y1 - b.y0)
    .filter((h) => h > 0)
    .sort((a, b) => a - b)
  return cut(bs, 1.2 * (hs[hs.length >> 1] ?? 10))
}

// Share of printable characters and words per non-empty line: a scrambled or
// symbol-only page, or one word per line, is poor text a caller may escalate.
export const pageQuality = (text: string) => {
  const lines = text.split('\n').filter((l) => l.trim())
  const bad = text.match(/[\p{Cc}\p{Co}\p{Cn}�]/gu)?.filter((c) => !/\s/.test(c)).length ?? 0
  const printable = text.length ? 1 - bad / text.length : 0
  const wordsPerLine = lines.length ? text.split(/\s+/).filter(Boolean).length / lines.length : 0
  return { printable, wordsPerLine, ok: printable >= 0.85 && wordsPerLine >= 2 }
}
