// HTTP-layer contract against the local fixture: redirect scoping, charset
// handling, the textual content-type guard, and deterministic bounded retry.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { fetchText, fetchTextWithinHost } from '../../src/core/http.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

describe('fetchTextWithinHost — exact-host redirect scoping', () => {
  test('follows a same-host redirect', async () => {
    const text = await fetchTextWithinHost(`${fx.origin}/redirect`, '127.0.0.1')
    expect(text).toContain('Alpha')
  })

  test('blocks an off-host redirect', async () => {
    expect(fetchTextWithinHost(`${fx.origin}/offsite`, '127.0.0.1')).rejects.toThrow(/off-site/)
  })
})

describe('fetchText — charset handling (B3)', () => {
  test('decodes windows-1252 declared in the header', async () => {
    const text = await fetchText(`${fx.origin}/charset/header-1252`)
    expect(text).toContain('café')
  })

  test('decodes windows-1252 declared only in <meta charset>', async () => {
    const text = await fetchText(`${fx.origin}/charset/meta-1252`)
    expect(text).toContain('café')
  })

  test('decodes a UTF-16LE body via its BOM', async () => {
    const text = await fetchText(`${fx.origin}/charset/bom16le`)
    expect(text).toContain('hello bom')
  })
})

describe('fetchText — content-type guard (B4)', () => {
  test('rejects binary bodies instead of emitting garbage', async () => {
    expect(fetchText(`${fx.origin}/binary`)).rejects.toThrow(/unsupported content-type/)
  })

  test('accepts XML (sitemaps)', async () => {
    const xml = await fetchText(`${fx.origin}/sitemap.xml`)
    expect(xml).toContain('<urlset>')
  })
})

describe('httpGet retry — deterministic and bounded', () => {
  test('retries through transient 503s and succeeds on the 3rd hit', async () => {
    const local = startFixture(defaultRoutes)
    try {
      const text = await fetchText(`${local.origin}/flaky?key=retry-ok&fails=2`)
      expect(text).toBe('flaky ok')
      expect(local.hits('/flaky')).toBe(3)
    } finally {
      local.stop()
    }
  }, 15_000)

  test('does not retry a plain 404', async () => {
    const local = startFixture(defaultRoutes)
    try {
      expect(fetchText(`${local.origin}/status?code=404`)).rejects.toThrow(/404/)
      await Bun.sleep(50)
      expect(local.hits('/status')).toBe(1)
    } finally {
      local.stop()
    }
  })

  test('gives up after 3 attempts on a persistent 503', async () => {
    const local = startFixture(defaultRoutes)
    try {
      expect(fetchText(`${local.origin}/status?code=503`)).rejects.toThrow(/503/)
      await Bun.sleep(1400)
      expect(local.hits('/status')).toBe(3)
    } finally {
      local.stop()
    }
  }, 15_000)

  test('does not retry a timeout abort (the --timeout budget)', async () => {
    const local = startFixture(defaultRoutes)
    try {
      expect(fetchText(`${local.origin}/stall`, { timeoutMs: 300 })).rejects.toThrow()
      await Bun.sleep(1400)
      expect(local.hits('/stall')).toBe(1)
    } finally {
      local.stop()
    }
  }, 15_000)
})
