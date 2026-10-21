// PARSE contract — real local file parsing (no network, no mocks).
// Tests the user-facing command behavior that `mise run run:parse` executes.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff, io } from '../_support/run.ts'

const TMP = join(tmpdir(), 'webular-parse-test')

const runParse = (args: string[]) => runCli('src/commands/parse.ts', args)

const htmlFile = join(TMP, 'test.html')
const txtFile = join(TMP, 'test.txt')
const jsonFile = join(TMP, 'test.json')
const mdFile = join(TMP, 'test.md')

beforeAll(
  eff(
    Effect.all(
      [
        io(() => Bun.write(htmlFile, '<h1>Hello Webular</h1><p>Parsed.</p>')),
        io(() => Bun.write(txtFile, 'plain text content for webular')),
        io(() => Bun.write(jsonFile, '{"key":"value","num":42}')),
        io(() => Bun.write(mdFile, '# Markdown Header\n\nSome paragraph text.')),
      ],
      { concurrency: 'unbounded' },
    ),
  ),
)

afterAll(eff(io(() => rm(TMP, { recursive: true, force: true }))))

describe('webular parse — local document to markdown/text (no network)', () => {
  test(
    'parses .html file and markdown contains heading text',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runParse(['--file', htmlFile, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.format).toBe('html')
        expect(data.markdown).toContain('Hello Webular')
      }),
    ),
    15_000,
  )

  test(
    'parses .txt file and markdown contains raw text',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runParse(['--file', txtFile, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.format).toBe('txt')
        expect(data.markdown).toContain('plain text content for webular')
      }),
    ),
    15_000,
  )

  test(
    'parses .json file and returns its contents as text',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runParse(['--file', jsonFile, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.format).toBe('json')
        expect(data.markdown).toContain('value')
      }),
    ),
    15_000,
  )

  test(
    'parses .md file and returns its raw text',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runParse(['--file', mdFile, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.format).toBe('md')
        expect(data.markdown).toContain('Markdown Header')
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when --file is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runParse([])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )
})
