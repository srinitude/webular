// Contract: the plugin's skills and manifests point at real things: commands,
// flags, tool inputs, and files. Each check lists every broken pointer at once.
import { expect, test } from 'bun:test'
import { dirname, resolve } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { schemas } from '../../plugins/webular/src/schemas.ts'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { machineSchema, paging } from '../../src/tools/web-machine.ts'
import { ROOT } from '../_support/root.ts'
import { coverage } from '../e2e/surface.ts'

const PLUGIN = `${ROOT}plugins/webular/`
const CLAUDE_ROOT = ['$', '{CLAUDE_PLUGIN_ROOT}'].join('')

// Commands no skill names, each with the reason. A stale entry fails the test.
const UNDOCUMENTED: Record<string, string> = {
  jev: 'It records and labels Jev calls for webular developers; no research flow uses it.',
}
// Flags that belong to a script, not to a webular command, and the file that reads them.
const FOREIGN_FLAGS: Record<string, string> = {
  http: 'plugins/webular/src/server.ts',
  manifest: 'plugins/webular/skills/rich-and-native-markdown/scripts/check.ts',
}

type Doc = { file: string; text: string }
const run = <A, E>(self: Effect.Effect<A, E, FileSystem.FileSystem>) =>
  Effect.runPromise(self.pipe(Effect.provide(BunServices.layer)))
const read = (path: string) => FileSystem.FileSystem.use((fs) => fs.readFileString(path))

const skillDocs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const names = (yield* fs.readDirectory(`${PLUGIN}skills`)).filter((n) => !n.endsWith('.md'))
  const dirs = names.map((name) => `${PLUGIN}skills/${name}`)
  const paths = yield* Effect.forEach(dirs, (dir) =>
    fs
      .readDirectory(dir, { recursive: true })
      .pipe(Effect.map((rel) => rel.filter((p) => p.endsWith('.md')).map((p) => `${dir}/${p}`))),
  )
  const docs = yield* Effect.forEach(paths.flat(), (file) =>
    read(file).pipe(Effect.map((text): Doc => ({ file, text }))),
  )
  return { names, docs }
})

const spans = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '')
const flagsIn = (text: string) => [...text.matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1] ?? '')
const short = (file: string) => file.replace(PLUGIN, '')

// Every `webular <command> ...` code span names a real command and its real flags.
test('skills name only real webular commands and flags', () =>
  run(
    Effect.gen(function* () {
      const { docs } = yield* skillDocs
      const { shared, flags } = yield* coverage
      const bad = docs.flatMap(({ file, text }) =>
        spans(text)
          .filter((s) => /^webular [a-z]/.test(s))
          .flatMap((s) => {
            const cmd = s.split(' ')[1] as keyof typeof flags
            if (!COMMAND_NAMES.includes(cmd)) return [`${short(file)}: ${s} (no such command)`]
            const known = [...shared, ...flags[cmd]]
            return flagsIn(s)
              .filter((f) => !known.includes(f))
              .map((f) => `${short(file)}: ${s} (--${f} is not a flag of ${cmd})`)
          }),
      )
      expect(bad).toEqual([])
    }),
  ))

// Any --flag a skill file shows is a webular flag, or a script flag the script reads.
test('every flag in a skill file exists somewhere', () =>
  run(
    Effect.gen(function* () {
      const { docs } = yield* skillDocs
      const { shared, flags } = yield* coverage
      const foreign = yield* Effect.forEach(Object.entries(FOREIGN_FLAGS), ([flag, file]) =>
        read(`${ROOT}${file}`).pipe(Effect.map((src) => (src.includes(`--${flag}`) ? [flag] : []))),
      )
      const known = new Set([...shared, ...Object.values(flags).flat(), ...foreign.flat()])
      const bad = docs.flatMap(({ file, text }) =>
        flagsIn(text)
          .filter((f) => !known.has(f))
          .map((f) => `${short(file)}: --${f}`),
      )
      expect(bad).toEqual([])
    }),
  ))

// The tool reference and the tool table match the plugin's tool schemas.
test('the research skill documents real tools and their real input fields', () =>
  run(
    Effect.gen(function* () {
      const dir = `${PLUGIN}skills/webular-research`
      const [skill, reference] = yield* Effect.all([
        read(`${dir}/SKILL.md`),
        read(`${dir}/references/tools.md`),
      ])
      // machine.next is served by `webular mcp`, not the plugin; its paging fields are shared.
      const shapes: Record<string, Record<string, unknown>> = {
        ...Object.fromEntries(Object.entries(schemas).map(([k, v]) => [k, v.shape])),
        'machine.next': Object.fromEntries(
          Object.entries(machineSchema.shape).filter(([k]) => !(k in paging)),
        ),
      }
      const tools = Object.keys(shapes)
      const rows = [...skill.matchAll(/\| `([a-z]+)` \|$/gm)].map((m) => m[1] ?? '')
      const sections = reference.split(/^## /m).slice(1)
      const bad = [
        ...rows.filter((t) => !tools.includes(t)).map((t) => `SKILL.md table: ${t}`),
        ...sections.flatMap((sec) => {
          const name = sec.split('\n')[0] ?? ''
          if (name === 'Connect' || name === 'Errors') return []
          if (!(name in shapes)) return [`tools.md: ## ${name} is not a tool`]
          const line = /^- Input: (.+)$/m.exec(sec)?.[1] ?? ''
          const named = spans(line.replace(/\([^)]*\)/g, '')).sort()
          const real = Object.keys(shapes[name] ?? {}).sort()
          return named.join() === real.join() ? [] : [`tools.md ${name}: [${named}] vs [${real}]`]
        }),
      ]
      expect(bad).toEqual([])
    }),
  ))

// A command is named in a code span or heading of some skill file, or has a reason here.
const isNamed = (docs: Doc[], cmd: string) =>
  docs.some(
    ({ text }) =>
      spans(text).some(
        (s) => s === cmd || s === `webular:${cmd}` || s.startsWith(`webular ${cmd}`),
      ) ||
      new RegExp(`^## ${cmd}$`, 'm').test(text),
  )

test('every command has a skill that names it, or a stated reason', () =>
  run(
    Effect.gen(function* () {
      const { docs } = yield* skillDocs
      const missing = COMMAND_NAMES.filter((c) => !isNamed(docs, c) && !(c in UNDOCUMENTED))
      const stale = Object.keys(UNDOCUMENTED).filter((c) => isNamed(docs, c))
      expect({ missing, stale }).toEqual({ missing: [], stale: [] })
    }),
  ))

// Files a skill links to, or names as scripts/ or references/ paths, exist.
test('files the skills link to or bundle exist', () =>
  run(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const { docs } = yield* skillDocs
      const targets = docs.flatMap(({ file, text }) => {
        const links = [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1] ?? '')
        const local = links.filter((l) => !/^[a-z]+:/.test(l)).map((l) => resolve(dirname(file), l))
        const skillDir = file.replace(/(skills\/[^/]+)\/.*/, '$1')
        const named = spans(text).filter((s) => /^(scripts|references)\/[\w./-]+$/.test(s))
        return [...local, ...named.map((n) => resolve(skillDir, n))].map((t) => [file, t] as const)
      })
      const found = yield* Effect.forEach(targets, ([, t]) => fs.exists(t))
      const bad = targets.filter((_, i) => !found[i]).map(([f, t]) => `${short(f)} -> ${short(t)}`)
      expect(bad).toEqual([])
    }),
  ))

const stringsOf = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(stringsOf)
      : []

// Both manifests, and both server configs, point at files inside the plugin that exist.
test('manifests and server configs point at files that exist', () =>
  run(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const manifests = ['plugin.json', '.claude-plugin/plugin.json', 'mcp.json', '.mcp.json']
      const parsed = yield* Effect.forEach(manifests, (m) =>
        read(`${PLUGIN}${m}`).pipe(Effect.map((t) => [m, stringsOf(JSON.parse(t))] as const)),
      )
      const targets = parsed.flatMap(([m, strings]) =>
        strings
          .filter((s) => s.startsWith('./') || s.startsWith(`${CLAUDE_ROOT}/`))
          .map((s) => [m, resolve(PLUGIN, s.replace(CLAUDE_ROOT, '.'))] as const),
      )
      expect(targets.length).toBeGreaterThanOrEqual(2)
      const found = yield* Effect.forEach(targets, ([, t]) => fs.exists(t))
      expect(targets.filter((_, i) => !found[i]).map(([m, t]) => `${m} -> ${short(t)}`)).toEqual([])
    }),
  ))

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

test('the plugin description counts its skills correctly', () =>
  run(
    Effect.gen(function* () {
      const { names } = yield* skillDocs
      const manifest = JSON.parse(yield* read(`${PLUGIN}plugin.json`)) as { description: string }
      expect(manifest.description).toContain(`${COUNT_WORDS[names.length]} skills`)
    }),
  ))
