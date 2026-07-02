// Shared deterministic route table for the fixture server. Content is static
// so byte-level output assertions hold across runs.
import type { Routes } from './fixture.ts'

function html(body: string): Response {
  const doc = `<!doctype html><html><head>${body.startsWith('<title') ? '' : '<title>fixture</title>'}${body}</head></html>`
  return new Response(doc, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function page(title: string, links = ''): Response {
  const para = `<p>Deterministic fixture body for ${title}. It has enough prose to satisfy readability extraction across repeated runs.</p>`
  return html(`<title>${title}</title></head><body><h1>${title}</h1>${para}${links}<body>`)
}

const a = (href: string): string => `<a href="${href}">${href}</a>`

const pages: Routes = {
  '/': () => page('Fixture Home', a('/a') + a('/b') + a('/c')),
  '/a': () => page('Alpha', a('/d')),
  '/b': () => page('Beta', a('/d') + a('/e')),
  '/c': () => page('Gamma'),
  '/d': () => page('Delta'),
  '/e': () => page('Epsilon'),
}

function latin1(s: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff))
}

function utf16le(s: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(2 + s.length * 2)
  out.set([0xff, 0xfe])
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    out.set([code & 0xff, code >> 8], 2 + i * 2)
  }
  return out
}

const CAFE_1252 = latin1(
  '<!doctype html><html><head><title>caf\xe9</title></head><body>caf\xe9</body></html>',
)
const META_1252 = latin1(
  '<!doctype html><html><head><meta charset="windows-1252"><title>caf\xe9</title></head><body>caf\xe9</body></html>',
)

const charset: Routes = {
  '/charset/header-1252': () =>
    new Response(CAFE_1252, { headers: { 'content-type': 'text/html; charset=windows-1252' } }),
  '/charset/meta-1252': () => new Response(META_1252, { headers: { 'content-type': 'text/html' } }),
  '/charset/bom16le': () =>
    new Response(
      utf16le(
        '<!doctype html><html><head><title>bom page</title></head><body>hello bom</body></html>',
      ),
      {
        headers: { 'content-type': 'text/html' },
      },
    ),
}

function stallStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('<html><body>partial'))
      // never closes — exercises idle/stall handling
    },
  })
}

const misc: Routes = {
  '/redirect': () => new Response(null, { status: 302, headers: { location: '/a' } }),
  '/offsite': () =>
    new Response(null, { status: 302, headers: { location: 'http://offsite.invalid/x' } }),
  '/status': (_req, url) =>
    new Response('status body', { status: Number(url.searchParams.get('code') ?? '500') }),
  '/bytes': (_req, url) =>
    new Response('x'.repeat(Number(url.searchParams.get('n') ?? '16')), {
      headers: { 'content-type': 'application/octet-stream' },
    }),
  '/slow': async (_req, url) => {
    await Bun.sleep(Number(url.searchParams.get('ms') ?? '0'))
    return page('Slow')
  },
  '/binary': () =>
    new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), {
      headers: { 'content-type': 'image/png' },
    }),
  '/stall': () => new Response(stallStream(), { headers: { 'content-type': 'text/html' } }),
}

// Parameterized so each test declares its own failure count and key —
// per-key counters keep a suite-shared fixture safe, and no retry-policy
// constant is duplicated here.
function flakyRoutes(): Routes {
  const hits = new Map<string, number>()
  return {
    '/flaky': (_req, url) => {
      const key = url.searchParams.get('key') ?? 'default'
      const fails = Number(url.searchParams.get('fails') ?? '2')
      const n = (hits.get(key) ?? 0) + 1
      hits.set(key, n)
      if (n > fails) return new Response('flaky ok', { headers: { 'content-type': 'text/plain' } })
      return new Response('unavailable', { status: 503 })
    },
  }
}

function sitemapRoutes(origin: string): Routes {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>${origin}/a</loc></url><url><loc>${origin}/b</loc></url></urlset>`
  return {
    '/sitemap.xml': () => new Response(xml, { headers: { 'content-type': 'application/xml' } }),
  }
}

export function defaultRoutes(origin: string): Routes {
  return { ...pages, ...charset, ...misc, ...flakyRoutes(), ...sitemapRoutes(origin) }
}
