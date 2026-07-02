// PARSE contract — real local file parsing (no network, no mocks).
// Tests the user-facing command behavior that `mise run run:parse` executes.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

const TMP = join(tmpdir(), 'webular-parse-test')

const runParse = (args: string[]) => runCli('src/commands/parse.ts', args)

let htmlFile: string
let txtFile: string
let jsonFile: string
let mdFile: string

beforeAll(async () => {
  await Bun.write(join(TMP, 'test.html'), '<h1>Hello Webular</h1><p>Parsed.</p>')
  await Bun.write(join(TMP, 'test.txt'), 'plain text content for webular')
  await Bun.write(join(TMP, 'test.json'), '{"key":"value","num":42}')
  await Bun.write(join(TMP, 'test.md'), '# Markdown Header\n\nSome paragraph text.')
  htmlFile = join(TMP, 'test.html')
  txtFile = join(TMP, 'test.txt')
  jsonFile = join(TMP, 'test.json')
  mdFile = join(TMP, 'test.md')
})

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true })
})

describe('webular parse — local document to markdown/text (no network)', () => {
  test('parses .html file and markdown contains heading text', async () => {
    const { code, out } = await runParse(['--file', htmlFile, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.format).toBe('html')
    expect(data.markdown).toContain('Hello Webular')
  }, 15_000)

  test('parses .txt file and markdown contains raw text', async () => {
    const { code, out } = await runParse(['--file', txtFile, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.format).toBe('txt')
    expect(data.markdown).toContain('plain text content for webular')
  }, 15_000)

  test('parses .json file and returns its contents as text', async () => {
    const { code, out } = await runParse(['--file', jsonFile, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.format).toBe('json')
    expect(data.markdown).toContain('value')
  }, 15_000)

  test('parses .md file and returns its raw text', async () => {
    const { code, out } = await runParse(['--file', mdFile, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.format).toBe('md')
    expect(data.markdown).toContain('Markdown Header')
  }, 15_000)

  test('exits with code 2 when --file is missing', async () => {
    const { code, err } = await runParse([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
