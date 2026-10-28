// bun scripts/docs-links.ts checks that every internal /docs link in the built
// site/dist/docs pages resolves to a built file. It exits 1 and lists each
// broken link. Run it after mise run site:build.

import { fileURLToPath } from 'node:url'
import { BunRuntime } from '@effect/platform-bun'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect, FileSystem } from 'effect'

const DIST = fileURLToPath(new URL('../site/dist/', import.meta.url))

// /docs/a/b/#x -> docs/a/b/index.html; /docs/llms.txt -> docs/llms.txt
export const target = (href: string): string => {
  const path = decodeURIComponent(href.split(/[?#]/)[0] ?? '').replace(/^\//, '')
  return /\.[a-z0-9]+$/i.test(path) ? path : `${path.replace(/\/?$/, '/')}index.html`
}

export const links = (html: string): string[] =>
  [...html.matchAll(/href="(\/docs(?:\/[^"]*)?)"/g)].map((m) => m[1] ?? '')

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const pages = (yield* fs.readDirectory(`${DIST}docs`, { recursive: true })).filter((p) =>
    p.endsWith('.html'),
  )
  const broken = new Set<string>()
  let checked = 0
  for (const page of pages)
    for (const href of links(yield* fs.readFileString(`${DIST}docs/${page}`))) {
      checked++
      if (!(yield* fs.exists(`${DIST}${target(href)}`))) broken.add(`${page} -> ${href}`)
    }
  yield* Effect.log(
    `docs links: ${checked} checked in ${pages.length} pages, ${broken.size} broken`,
  )
  for (const line of broken) yield* Effect.logError(line)
  if (broken.size) return yield* Effect.fail(new Error(`${broken.size} broken docs links`))
})

if (import.meta.main) program.pipe(Effect.provide(BunServices.layer), BunRuntime.runMain)
