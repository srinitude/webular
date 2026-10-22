// Guard: every root-relative link in the site's Markdown content points at a route the build
// produced. site/dist exists only after `mise run site:build`; without it the test passes
// untouched. The install scripts are served by site/public/_redirects, so they count too.

import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const SITE = `${ROOT}site/`
const ROUTE_LINK = /\]\((\/[^)\s#?]*)/g

const redirectNames = (text: string) =>
  text
    .split('\n')
    .map((line) => line.split(/\s+/)[0] ?? '')
    .filter((name) => name.startsWith('/'))

const routesIn = (text: string) => [...text.matchAll(ROUTE_LINK)].map((m) => m[1] ?? '')

// A route is built as a file, as route.html, or as route/index.html.
const isBuilt = (route: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const found = yield* Effect.forEach(
      [route, `${route}.html`, `${route}/index.html`],
      (p) => fs.exists(`${SITE}dist${p}`),
      { concurrency: 3 },
    )
    return found.some(Boolean)
  })

test(
  'every route link in the site content exists in the build',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      if (!(yield* fs.exists(`${SITE}dist`))) return
      const served = new Set(redirectNames(yield* fs.readFileString(`${SITE}public/_redirects`)))
      const folder = `${SITE}src/content`
      const files = (yield* fs.readDirectory(folder)).filter((n) => n.endsWith('.md'))
      const links = yield* Effect.forEach(
        files,
        (name) =>
          fs
            .readFileString(`${folder}/${name}`)
            .pipe(Effect.map((text) => routesIn(text).map((route) => ({ name, route })))),
        { concurrency: 4 },
      )
      const missing: string[] = []
      for (const { name, route } of links.flat()) {
        if (!served.has(route) && !(yield* isBuilt(route))) missing.push(`${name}: ${route}`)
      }
      expect(missing).toEqual([])
    }),
  ),
)
