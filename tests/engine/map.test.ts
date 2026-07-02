// MAP contract (B11/B12/B15): origin-root sitemap resolution, one-level
// sitemapindex recursion in child order with surfaced child failures, and
// normalized dedup of discovered links.
import { describe, expect, test } from 'bun:test'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'

function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { 'content-type': 'application/xml' },
  })
}

function page(links: string[]): Response {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('')
  return new Response(
    `<!doctype html><html><head><title>t</title></head><body>${anchors}</body></html>`,
    {
      headers: { 'content-type': 'text/html' },
    },
  )
}

const urlset = (locs: string[]): string =>
  `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`

interface MapResult {
  links: string[]
  errors: { url: string; reason: string }[]
  count: number
}

async function runMap(url: string): Promise<MapResult> {
  const run = await mapWorkflow.createRun({ runId: 'map-test' })
  const outcome = await run.start({ inputData: { url } })
  if (outcome.status !== 'success') throw new Error(`map failed: ${outcome.status}`)
  return outcome.result as MapResult
}

describe('map — sitemap discovery', () => {
  test('resolves the sitemap at the ORIGIN root, not path-relative (B11)', async () => {
    const fx = startFixture(
      (origin): Routes => ({
        '/sitemap.xml': () => xml(urlset([`${origin}/a`, `${origin}/b`])),
        '/deep/page': () => page(['/z1', '/z2']),
      }),
    )
    try {
      const { links, errors } = await runMap(`${fx.origin}/deep/page`)
      expect(links).toEqual([`${fx.origin}/a`, `${fx.origin}/b`])
      expect(errors).toEqual([])
      expect(fx.hits('/sitemap.xml')).toBe(1)
    } finally {
      fx.stop()
    }
  }, 15_000)

  test('recurses one sitemapindex level in child order and surfaces child failures (B12)', async () => {
    const fx = startFixture(
      (origin): Routes => ({
        '/sitemap.xml': () =>
          xml(
            `<sitemapindex><sitemap><loc>${origin}/sm-1.xml</loc></sitemap><sitemap><loc>${origin}/sm-404.xml</loc></sitemap><sitemap><loc>${origin}/sm-2.xml</loc></sitemap></sitemapindex>`,
          ),
        '/sm-1.xml': () => xml(urlset([`${origin}/p1`, `${origin}/p2`])),
        '/sm-2.xml': () => xml(urlset([`${origin}/p3`, `${origin}/p1#dup`])),
      }),
    )
    try {
      const { links, errors } = await runMap(fx.origin)
      expect(links).toEqual([`${fx.origin}/p1`, `${fx.origin}/p2`, `${fx.origin}/p3`])
      expect(errors).toEqual([
        { url: `${fx.origin}/sm-404.xml`, reason: expect.stringContaining('404') },
      ])
    } finally {
      fx.stop()
    }
  }, 15_000)

  test('falls back to page links with normalized dedup (B15)', async () => {
    const fx = startFixture(
      (origin): Routes => ({
        '/': () => page(['/x', '/x#f', `${origin.toUpperCase()}/x`, '/y']),
      }),
    )
    try {
      const { links, count } = await runMap(fx.origin)
      expect(links).toEqual([`${fx.origin}/x`, `${fx.origin}/y`])
      expect(count).toBe(2)
    } finally {
      fx.stop()
    }
  }, 15_000)
})
