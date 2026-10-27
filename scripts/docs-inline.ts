// Next hydrates with inline scripts. Hashing them into a /docs CSP header does not fit:
// a long page has 40+ of them, past the 2,000-character line limit of _headers. So each
// one moves, unchanged and in place, to a same-origin file named by its sha256, and the
// site-wide CSP (script-src 'self') covers /docs as it is. Data scripts (JSON) stay inline.
import { Effect, type FileSystem } from 'effect'

const INLINE = /<script((?:(?!\bsrc=)[^>])*)>([\s\S]+?)<\/script>/g
const DATA = /\btype="(?!text\/javascript"|module")/

export const externalize = (html: string) => {
  const files = new Map<string, string>()
  const out = html.replace(INLINE, (whole, attrs: string, js: string) => {
    if (DATA.test(attrs)) return whole
    const name = `${new Bun.CryptoHasher('sha256').update(js).digest('hex')}.js`
    files.set(name, js)
    return `<script${attrs} src="/docs/_inline/${name}"></script>`
  })
  return { html: out, files }
}

// Copies the Next export to dist (ending in /), then moves every page's inline scripts out.
export const copyExport = (fs: FileSystem.FileSystem, out: string, dist: string) =>
  Effect.gen(function* () {
    yield* fs.copy(out, dist, { overwrite: true })
    yield* fs.makeDirectory(`${dist}_inline`, { recursive: true })
    const pages = (yield* fs.readDirectory(dist, { recursive: true })).filter((p) =>
      p.endsWith('.html'),
    )
    for (const page of pages) {
      const { html, files } = externalize(yield* fs.readFileString(`${dist}${page}`))
      yield* fs.writeFileString(`${dist}${page}`, html)
      for (const [name, js] of files) yield* fs.writeFileString(`${dist}_inline/${name}`, js)
    }
  })
