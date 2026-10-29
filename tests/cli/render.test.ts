// Output contract: human text differs from --json, -o writes what stdout carries,
// partial failures note on stderr, batch maps exit codes 0/1/3.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { renderFor } from '../../src/cli/render.ts'
import { runCli } from '../_support/cli.ts'
import { type Routes, startFixture, useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const page = (body: string) =>
  new Response(`<html><head><title>R</title></head><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html' },
  })
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
  test(
    'map human output is plain lines, distinct from --json',
    eff(
      Effect.gen(function* () {
        const human = yield* runCmd('map', ['--url', fx.origin])
        const json = yield* runCmd('map', ['--url', fx.origin, '--json'])
        expect(human.code).toBe(0)
        expect(human.out).not.toBe(json.out)
        expect(
          human.out
            .trim()
            .split('\n')
            .every((l) => l.startsWith('http')),
        ).toBe(true)
      }),
    ),
    15_000,
  )

  test(
    'scrape -o writes the markdown, not JSON',
    eff(
      Effect.gen(function* () {
        const dest = join(yield* tmpDir('webular-'), 'render.md')
        const { code } = yield* runCmd('scrape', ['--url', `${fx.origin}/`, '-o', dest])
        expect(code).toBe(0)
        const written = yield* (yield* FileSystem.FileSystem).readFileString(dest)
        expect(written).toContain('Fixture Home')
        expect(written.startsWith('{')).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'media renders a one-line human summary',
    eff(
      Effect.gen(function* () {
        const dest = join(yield* tmpDir('webular-'), 'render.bin')
        const { code, out } = yield* runCmd('media', [
          '--url',
          `${fx.origin}/bytes?n=64`,
          '--download',
          '-o',
          dest,
        ])
        expect(code).toBe(0)
        expect(out.trim()).toBe(`download ${fx.origin}/bytes?n=64 -> ${dest} (64 bytes)`)
      }),
    ),
    15_000,
  )

  test(
    'batch exits 1 when every target fails',
    eff(
      Effect.gen(function* () {
        const bad = `${fx.origin}/status?code=500`
        const { code } = yield* runCmd('batch', ['--urls', `${bad},${bad}`, '--json'])
        expect(code).toBe(1)
      }),
    ),
    20_000,
  )

  test(
    'batch exits 3 on partial failure',
    eff(
      Effect.gen(function* () {
        const { code } = yield* runCmd('batch', [
          '--urls',
          `${fx.origin}/a,${fx.origin}/status?code=500`,
          '--json',
        ])
        expect(code).toBe(3)
      }),
    ),
    20_000,
  )

  test(
    'crawl reports partial fetch failures on stderr and still exits 0',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(
          (): Routes => ({
            '/': () => page('<a href="/a">a</a><a href="/nope">n</a>'),
            '/a': () => page('ok'),
          }),
        )
        const { code, err } = yield* runCmd('crawl', ['--url', `${local.origin}/`, '--json'])
        expect(code).toBe(0)
        expect(err).toContain('failed')
      }),
    ),
    20_000,
  )

  test(
    'crawl exits 1 when nothing was crawled and errors exist',
    eff(
      Effect.gen(function* () {
        // A failed root asks the archive indexes; the fixture stands in for them (it 404s
        // their paths), so no live index can hand back a 127.0.0.1 capture and exit 0.
        const env = { WEBULAR_SOURCE_ORIGIN: fx.origin, WEBULAR_SOURCE_GAP_MS: '0' }
        const args = ['--url', `${fx.origin}/status?code=500`, '--json']
        const { code } = yield* runCli('src/commands/crawl.ts', args, { env })
        expect(code).toBe(1)
      }),
    ),
    20_000,
  )
})
