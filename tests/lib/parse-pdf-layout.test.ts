// Pure PDF layout helpers on synthetic text items: no PDF is read.
import { expect, test } from 'bun:test'
import { dropRepeatedLines } from '../../src/lib/parse-pdf.ts'
import { columnText, pageQuality, type TextItem } from '../../src/lib/parse-pdf-layout.ts'

const item = (str: string, x: number, y: number, width = 80): TextItem => ({
  str,
  hasEOL: true,
  width,
  height: 10,
  transform: [10, 0, 0, 10, x, y],
})

test('a line on more than 60 percent of pages goes, digits ignored', () => {
  const page = (n: number, body: string) => `Intro\nDraft v${n} internal\n${body}\nEnd of ${n}`
  const bodies = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
  const out = dropRepeatedLines(bodies.map((b, i) => page(i + 1, b)))
  expect(out.join('\n')).not.toContain('Draft v')
  expect(out[1]).toContain('beta')
})

test('a line on 60 percent of pages or fewer stays; under 3 pages nothing goes', () => {
  const pages = ['x\nsame', 'y\nsame', 'z\nsame', 'u\nother', 'v\nother2']
  expect(dropRepeatedLines(pages)[0]).toContain('same')
  const two = ['a\nsame', 'b\nsame']
  expect(dropRepeatedLines(two)).toEqual(two)
})

test('two columns read left then right, not row by row', () => {
  const items = [
    item('L1', 50, 700),
    item('R1', 350, 700),
    item('L2', 50, 686),
    item('R2', 350, 686),
    item('L3', 50, 672),
    item('R3', 350, 672),
  ]
  expect(columnText(items)).toBe('L1\nL2\nL3\nR1\nR2\nR3\n')
})

test('a full-width title reads first, then the columns', () => {
  const items = [
    item('Title', 50, 760, 380),
    item('L1', 50, 700),
    item('R1', 350, 700),
    item('L2', 50, 686),
    item('R2', 350, 686),
  ]
  expect(columnText(items)).toBe('Title\nL1\nL2\nR1\nR2\n')
})

test('one column and words on one line keep stream order', () => {
  const words = [
    { ...item('Hello', 50, 700, 30), hasEOL: false },
    { ...item('world', 90, 700, 30), hasEOL: true },
    item('next line', 50, 686, 60),
  ]
  expect(columnText(words)).toBe('Helloworld\nnext line\n')
})

test('page quality flags a page of symbols or one-word lines', () => {
  const prose = 'A normal line of readable words here.\nAnother readable line follows.'
  expect(pageQuality(prose).ok).toBe(true)
  expect(pageQuality('\u0001\u0002 \u0003\u0004\n#@ ~~ ^^').ok).toBe(false)
  expect(pageQuality('a\nb\nc\nd\ne\nf').ok).toBe(false)
  expect(pageQuality('').ok).toBe(false)
})

test('a page that is only repeated lines keeps its text', () => {
  const pages = ['page 1', 'page 2', 'page 3', 'page 4']
  expect(dropRepeatedLines(pages)).toEqual(pages)
})
