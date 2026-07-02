// Output contract (C4/B30): every command renders human text distinct from
// --json, -o writes exactly what stdout would carry, partial failures note on
// stderr, and batch maps exit codes 0/1/3.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderFor } from '../../src/cli/render.ts'
import { runCli } from '../_support/cli.ts'
import { type Fixture, type Routes, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const runCmd = (cmd: string, args: string[]) => runCli(`src/commands/${cmd}.ts`, args)

describe('renderFor — per-command human renderers (unit)', () => {
  test('research renders the report itself', () => {
    const render = renderFor('research')
    expect(render?.({ topic: 't', report: '# Research: t', sources: [], errors: [] })).toBe(
      '# Research: t',
    )
  })

  test('answer renders answer plus a Sources list', () => {
    const text = renderFor('answer')?.({
      query: 'q',
      answer: 'The answer.',
      sources: [{ title: 'One', url: 'https://one.dev' }],
      errors: [],
    })
    expect(text).toContain('The answer.')
    expect(text).toContain('Sources:')
    expect(text).toContain('https://one.dev')
  })

  test('map renders one URL per line', () => {
    expect(
      renderFor('map')?.({
        url: 'u',
        count: 2,
        links: ['https://a.dev/', 'https://b.dev/'],
        errors: [],
      }),
    ).toBe('https://a.dev/\nhttps://b.dev/')
  })

  test('batch renders per-URL rows and an ok summary', () => {
    const text = renderFor('batch')?.({
      op: 'scrape',
      count: 2,
      results: [
        { url: 'https://a.dev', ok: true, title: 'A' },
        { url: 'https://b.dev', ok: false, error: 'boom' },
      ],
    })
    expect(text).toContain('ok   https://a.dev')
    expect(text).toContain('fail https://b.dev')
    expect(text).toContain('ok 1/2')
  })

  test('doctor renders ok/fail lines', () => {
    const text = renderFor('doctor')?.({
      ok: true,
      checks: [{ name: 'bun', ok: true, detail: '1.3.14' }],
    })
    expect(text).toContain('ok')
    expect(text).toContain('bun')
  })

  test('search renders numbered hits', () => {
    const text = renderFor('search')?.({
      query: 'q',
      count: 1,
      results: [{ title: 'T', url: 'https://t.dev', description: 'D' }],
    })
    expect(text).toContain('1. T')
    expect(text).toContain('https://t.dev')
  })
})

describe('command output contract (integration)', () => {
  test('map human output is plain lines, distinct from --json', async () => {
    const human = await runCmd('map', ['--url', fx.origin])
    const json = await runCmd('map', ['--url', fx.origin, '--json'])
    expect(human.code).toBe(0)
    expect(human.out).not.toBe(json.out)
    expect(
      human.out
        .trim()
        .split('\n')
        .every((l) => l.startsWith('http')),
    ).toBe(true)
  }, 15_000)

  test('scrape -o writes the markdown, not JSON', async () => {
    const dest = join(tmpdir(), `webular-render-${Date.now()}.md`)
    const { code } = await runCmd('scrape', ['--url', `${fx.origin}/`, '-o', dest])
    expect(code).toBe(0)
    const written = readFileSync(dest, 'utf8')
    expect(written).toContain('Fixture Home')
    expect(written.startsWith('{')).toBe(false)
    rmSync(dest, { force: true })
  }, 15_000)

  test('media renders a one-line human summary', async () => {
    const dest = join(tmpdir(), `webular-render-${Date.now()}.bin`)
    const { code, out } = await runCmd('media', [
      '--url',
      `${fx.origin}/bytes?n=64`,
      '--download',
      '-o',
      dest,
    ])
    expect(code).toBe(0)
    expect(out.trim()).toBe(`download ${fx.origin}/bytes?n=64 -> ${dest} (64 bytes)`)
    rmSync(dest, { force: true })
  }, 15_000)

  test('batch exits 1 when every target fails', async () => {
    const bad = `${fx.origin}/status?code=500`
    const { code } = await runCmd('batch', ['--urls', `${bad},${bad}`, '--json'])
    expect(code).toBe(1)
  }, 20_000)

  test('batch exits 3 on partial failure', async () => {
    const { code } = await runCmd('batch', [
      '--urls',
      `${fx.origin}/a,${fx.origin}/status?code=500`,
      '--json',
    ])
    expect(code).toBe(3)
  }, 20_000)

  test('crawl reports partial fetch failures on stderr and still exits 0', async () => {
    const local = startFixture(
      (origin): Routes => ({
        '/': () =>
          new Response(
            `<html><head><title>R</title></head><body><a href="/a">a</a><a href="/nope">n</a></body></html>`,
            { headers: { 'content-type': 'text/html' } },
          ),
        '/a': () =>
          new Response('<html><head><title>A</title></head><body>ok</body></html>', {
            headers: { 'content-type': 'text/html' },
          }),
      }),
    )
    try {
      const { code, err } = await runCmd('crawl', ['--url', `${local.origin}/`, '--json'])
      expect(code).toBe(0)
      expect(err).toContain('failed')
    } finally {
      local.stop()
    }
  }, 20_000)

  test('crawl exits 1 when nothing was crawled and errors exist', async () => {
    const { code } = await runCmd('crawl', ['--url', `${fx.origin}/status?code=500`, '--json'])
    expect(code).toBe(1)
  }, 20_000)
})
