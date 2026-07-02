// Parse guards (B24): binary formats fail loudly instead of decoding to
// garbage at exit 0; CSV/JSON become true markdown (fenced blocks).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDocument } from '../../src/lib/parse.ts'

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'webular-parse-'))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('parseDocument — binary guards and markdown-true output', () => {
  test('rejects .xlsx by extension with the supported list', async () => {
    const file = join(dir, 'sheet.xlsx')
    writeFileSync(file, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02]))
    expect(parseDocument(file)).rejects.toThrow(/unsupported binary format .xlsx/)
  })

  test('rejects NUL-containing files that slip past the extension check', async () => {
    const file = join(dir, 'data.log')
    writeFileSync(file, Buffer.from([0x68, 0x69, 0x00, 0x00, 0x62, 0x79, 0x65]))
    expect(parseDocument(file)).rejects.toThrow(/binary/)
  })

  test('emits CSV as a fenced csv block', async () => {
    const file = join(dir, 'table.csv')
    writeFileSync(file, 'a,b\n1,2\n')
    const { markdown, format } = await parseDocument(file)
    expect(format).toBe('csv')
    expect(markdown).toBe('```csv\na,b\n1,2\n```')
  })

  test('emits JSON as a fenced json block', async () => {
    const file = join(dir, 'obj.json')
    writeFileSync(file, '{"value":1}')
    const { markdown } = await parseDocument(file)
    expect(markdown).toBe('```json\n{"value":1}\n```')
  })

  test('plain text passes through untouched', async () => {
    const file = join(dir, 'note.txt')
    writeFileSync(file, 'hello world')
    const { markdown } = await parseDocument(file)
    expect(markdown).toBe('hello world')
  })
})
