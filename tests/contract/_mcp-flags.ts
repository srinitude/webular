// Reads CLI flags from the command sources, so the MCP contract test compares
// tool inputs with the real flag specs, not a copy of them.
import { Effect } from 'effect'
import { ROOT } from '../_support/root.ts'
import { io } from '../_support/run.ts'

const KEY = /['"]?([\w-]+)['"]?:\s*\{\s*type:/g
const keysIn = (block: string) => [...block.matchAll(KEY)].map((m) => m[1] as string)
const read = (path: string) => io(() => Bun.file(`${ROOT}${path}`).text())

// The flags every command takes (src/core/args.ts COMMON).
export const commonFlags = read('src/core/args.ts').pipe(
  Effect.map((src) => keysIn(src.split('const COMMON')[1]?.split('}\n')[0] ?? '')),
)

// The flags one command declares in its parseFlags call, inline or as a FLAGS const.
export const cliFlags = (command: string) =>
  read(`src/commands/${command}.ts`).pipe(
    Effect.map((src) =>
      keysIn(
        src.split('parseFlags(Bun.argv.slice(2), {')[1]?.split('})')[0] ??
          src.split('const FLAGS = {')[1]?.split('} as const')[0] ??
          '',
      ),
    ),
  )

// The flag a tool input becomes: runCommand's toFlags turns camelCase keys into
// kebab-case, so `ignoreRobots` is `--ignore-robots`.
export const flagOf = (input: string) => input.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
