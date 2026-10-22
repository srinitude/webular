// batch finishes promptly and reports every item when one URL answers a real
// HTTP 404 and another a real HTTP 500 (local Bun.serve fixture, no mocks).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const BOUND_MS = 20_000

test(
  'batch reports both items when one is a 404 and the other a 500, within the bound',
  eff(
    Effect.gen(function* () {
      const fx = yield* startFixture(() => ({
        '/missing': () => new Response('gone', { status: 404 }),
        '/broken': () => new Response('boom', { status: 500 }),
      }))
      const urls = [`${fx.origin}/missing`, `${fx.origin}/broken`]
      const started = Date.now()
      const { code, out } = yield* runCli('src/commands/batch.ts', [
        '--urls',
        urls.join(','),
        '--json',
      ])
      expect(Date.now() - started).toBeLessThan(BOUND_MS)
      expect(code).toBe(1)
      const data = JSON.parse(out)
      expect(data.count).toBe(2)
      expect(data.results.map((r: { url: string }) => r.url).sort()).toEqual([...urls].sort())
      for (const r of data.results) {
        expect(r.ok).toBe(false)
        expect(typeof r.error).toBe('string')
      }
      const err = (u: string): string =>
        data.results.find((r: { url: string }) => r.url === u).error
      expect(err(urls[0] as string)).toContain('404')
      expect(err(urls[1] as string)).toContain('500')
    }),
  ),
  60_000,
)
