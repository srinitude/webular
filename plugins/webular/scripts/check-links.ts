// Links: every relative Markdown link and #anchor under plugins/webular resolves.
import { Effect } from 'effect'
import { exists, files, isExternal, links, pluginDir, proseLines, read, rel, run } from './lib.ts'

// GitHub-style heading slug.
export const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

export const anchors = (text: string) =>
  new Set(
    proseLines(text).flatMap(({ text: t }) =>
      /^#{1,6}\s+(.*)$/.exec(t) ? [slug(t.replace(/^#+\s+/, ''))] : [],
    ),
  )

const resolve = (from: string, target: string) => {
  const parts = from.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

const checkFile = (file: string) =>
  Effect.gen(function* () {
    const text = yield* read(file)
    const out: string[] = []
    for (const { line, target } of links(text)) {
      if (isExternal(target)) continue
      const [pathPart = '', anchor] = decodeURI(target).split('#')
      const dest = pathPart === '' ? file : resolve(file, pathPart)
      if (!(yield* exists(dest))) {
        out.push(`${rel(file)}:${line}: broken link ${target}`)
      } else if (
        anchor &&
        dest.endsWith('.md') &&
        !anchors(dest === file ? text : yield* read(dest)).has(anchor.toLowerCase())
      ) {
        out.push(`${rel(file)}:${line}: missing anchor #${anchor} in ${rel(dest)}`)
      }
    }
    return out
  })

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const md = (yield* files(pluginDir)).filter((f) => f.endsWith('.md'))
      return (yield* Effect.forEach(md, checkFile, { concurrency: 8 })).flat()
    }),
  )
