// Shared helpers for the plugin check scripts: file walking, Markdown scanning, and the runner.
import { fileURLToPath } from 'node:url'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Data, Effect, FileSystem } from 'effect'

const slash = (p: string) => p.replaceAll('\\', '/')
const repoRoot = slash(fileURLToPath(new URL('../../../', import.meta.url)))
export const pluginDir = `${repoRoot}plugins/webular`
export const rel = (p: string) => (p.startsWith(repoRoot) ? p.slice(repoRoot.length) : p)

class Violations extends Data.TaggedError('Violations')<{ readonly count: number }> {}

// Every file under dir (absolute, sorted), skipping node_modules. A missing dir gives [].
export const files = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    if (!(yield* fs.exists(dir))) return [] as string[]
    const names = (yield* fs.readDirectory(dir, { recursive: true })).map(slash)
    const found = yield* Effect.forEach(
      names.filter((n) => !n.split('/').includes('node_modules')),
      (n) =>
        fs.stat(`${dir}/${n}`).pipe(Effect.map((s) => (s.type === 'File' ? `${dir}/${n}` : ''))),
      { concurrency: 16 },
    )
    return found.filter(Boolean).sort()
  })

export const read = (path: string) =>
  Effect.gen(function* () {
    return yield* (yield* FileSystem.FileSystem).readFileString(path)
  })

export const exists = (path: string) =>
  Effect.gen(function* () {
    return yield* (yield* FileSystem.FileSystem).exists(path)
  })

// Lines outside fenced code blocks, with 1-based line numbers.
export const proseLines = (text: string) => {
  let fenced = false
  return text.split('\n').flatMap((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      return []
    }
    return fenced ? [] : [{ line: i + 1, text: line }]
  })
}

// Markdown link targets outside code fences: [text](target "title").
export const links = (text: string) =>
  proseLines(text).flatMap(({ line, text: t }) =>
    [...t.matchAll(/\[[^\]]*\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)].map((m) => ({
      line,
      target: m[1] as string,
    })),
  )

export const isExternal = (target: string) => /^[a-z][a-z0-9+.-]*:/i.test(target)

// Resolves a relative link target against the file that holds it.
export const resolve = (from: string, target: string) => {
  const parts = from.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

// Runs a check. The program returns one "file:line: message" string per violation.
export const run = (
  program: Effect.Effect<ReadonlyArray<string>, unknown, FileSystem.FileSystem>,
) =>
  program.pipe(
    Effect.flatMap((found) =>
      found.length === 0
        ? Console.log('ok')
        : Console.error(found.join('\n')).pipe(
            Effect.andThen(Effect.fail(new Violations({ count: found.length }))),
          ),
    ),
    Effect.provide(BunServices.layer),
    BunRuntime.runMain({ disableErrorReporting: true }),
  )
