// Reachable: every file under a skill folder is linked from its SKILL.md, directly or through a linked file.
import { Effect } from 'effect'
import { files, isExternal, links, pluginDir, read, rel, resolve, run } from './lib.ts'

const reachable = (skillDir: string, all: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const seen = new Set<string>([`${skillDir}/SKILL.md`])
    const queue = [`${skillDir}/SKILL.md`]
    for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
      if (!file.endsWith('.md')) continue
      for (const { target } of links(yield* read(file))) {
        const path = target.split('#')[0] ?? ''
        if (isExternal(target) || path === '') continue
        const dest = resolve(file, decodeURI(path))
        if (all.has(dest) && !seen.has(dest)) {
          seen.add(dest)
          queue.push(dest)
        }
      }
    }
    return seen
  })

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const all = yield* files(`${pluginDir}/skills`)
      const set = new Set(all)
      const dirs = [...set]
        .filter((f) => f.endsWith('/SKILL.md'))
        .map((f) => f.slice(0, -'/SKILL.md'.length))
      const out: string[] = []
      for (const dir of dirs) {
        const seen = yield* reachable(dir, set)
        for (const f of all.filter((f) => f.startsWith(`${dir}/`) && !seen.has(f))) {
          out.push(`${rel(f)}:1: not linked from ${rel(dir)}/SKILL.md`)
        }
      }
      return out
    }),
  )
