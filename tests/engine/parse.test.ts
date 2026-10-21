// Parse guards (B24): binary formats fail loudly instead of decoding to
// garbage at exit 0; CSV/JSON become true markdown (fenced blocks).
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect } from 'effect'
import { parseDocument } from '../../src/lib/parse.ts'
import { eff, failMsg, io, tmpDir } from '../_support/run.ts'

describe('parseDocument — binary guards and markdown-true output', () => {
  test(
    'rejects .xlsx by extension with the supported list',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-parse-')
        const file = join(dir, 'sheet.xlsx')
        yield* io(() => Bun.write(file, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02])))
        expect(yield* failMsg(parseDocument(file))).toMatch(/unsupported binary format .xlsx/)
      }),
    ),
  )

  test(
    'rejects NUL-containing files that slip past the extension check',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-parse-')
        const file = join(dir, 'data.log')
        yield* io(() => Bun.write(file, Buffer.from([0x68, 0x69, 0x00, 0x00, 0x62, 0x79, 0x65])))
        expect(yield* failMsg(parseDocument(file))).toMatch(/binary/)
      }),
    ),
  )

  test(
    'emits CSV as a fenced csv block',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-parse-')
        const file = join(dir, 'table.csv')
        yield* io(() => Bun.write(file, 'a,b\n1,2\n'))
        const { markdown, format } = yield* parseDocument(file)
        expect(format).toBe('csv')
        expect(markdown).toBe('```csv\na,b\n1,2\n```')
      }),
    ),
  )

  test(
    'emits JSON as a fenced json block',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-parse-')
        const file = join(dir, 'obj.json')
        yield* io(() => Bun.write(file, '{"value":1}'))
        const { markdown } = yield* parseDocument(file)
        expect(markdown).toBe('```json\n{"value":1}\n```')
      }),
    ),
  )

  test(
    'plain .html drops unsafe markup',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-parse-')
        const file = join(dir, 'page.html')
        yield* io(() =>
          Bun.write(
            file,
            '<p onclick="x()">hi <a href="javascript:alert(1)">link</a></p><script>alert(2)</script>',
          ),
        )
        const { markdown } = yield* parseDocument(file)
        expect(markdown).toContain('hi')
        expect(markdown).not.toMatch(/javascript:|alert|onclick/)
      }),
    ),
  )

  test(
    'plain text passes through untouched',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-parse-')
        const file = join(dir, 'note.txt')
        yield* io(() => Bun.write(file, 'hello world'))
        const { markdown } = yield* parseDocument(file)
        expect(markdown).toBe('hello world')
      }),
    ),
  )
})
