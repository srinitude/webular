// bun scripts/docs-links.ts checks that every internal link (href or src that
// starts with one /) in every built site/dist page resolves the way the static
// host serves it: a file, path.html, path/index.html, or a _redirects source.
// mise run docs:build runs it last. It exits 1 and lists each broken link.

import { fileURLToPath } from 'node:url'
import { BunRuntime } from '@effect/platform-bun'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect, FileSystem } from 'effect'

const DIST = fileURLToPath(new URL('../site/dist/', import.meta.url))

// The files that can answer a path: /docs/a/#x -> docs/a/index.html; /docs -> docs.html or docs/index.html.
export const targets = (href: string): string[] => {
  const path = decodeURIComponent(href.split(/[?#]/)[0] ?? '').replace(/^\//, '')
  if (path === '' || path.endsWith('/')) return [`${path}index.html`]
  return /\.[a-z0-9]+$/i.test(path) ? [path] : [`${path}.html`, `${path}/index.html`]
}

export const links = (html: string): string[] =>
  [...html.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1] ?? '')

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A _redirects source matches its path, with each :name standing for one segment.
export const redirects = (text: string) => {
  const sources = text
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0] ?? '')
    .filter((s) => s.startsWith('/'))
    .map((s) => new RegExp(`^${escapeRegex(s).replace(/:\w+/g, '[^/]+')}$`))
  return (path: string) => sources.some((re) => re.test(path))
}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const all = yield* fs.readDirectory(DIST, { recursive: true })
  const pages = all.filter((p) => p.endsWith('.html'))
  const files = new Set(all)
  const redirected = redirects(yield* fs.readFileString(`${DIST}_redirects`))
  const broken = new Set<string>()
  let checked = 0
  for (const page of pages)
    for (const href of new Set(links(yield* fs.readFileString(`${DIST}${page}`)))) {
      checked++
      const ok = targets(href).some((t) => files.has(t)) || redirected(href.split(/[?#]/)[0] ?? '')
      if (!ok) broken.add(`${page} -> ${href}`)
    }
  yield* Effect.log(
    `site links: ${checked} checked in ${pages.length} pages, ${broken.size} broken`,
  )
  for (const line of broken) yield* Effect.logError(line)
  if (broken.size) return yield* Effect.fail(new Error(`${broken.size} broken site links`))
})

if (import.meta.main) program.pipe(Effect.provide(BunServices.layer), BunRuntime.runMain)
