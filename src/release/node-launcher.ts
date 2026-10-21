#!/usr/bin/env node
// Node launcher behind the npm package's "bin": finds the native webular-<key>
// package that npm installed from optionalDependencies and runs its binary, so
// `npm i -g webular` works with only Node installed, the way esbuild and biome
// ship. Without that package (an install that omits optional dependencies),
// Bun runs bin/webular.ts when it is on PATH.
// Why a .js file ships at all: npm runs every bin under Node, and Node refuses
// to strip types from files under node_modules. mise.toml tasks.build bundles
// this file to dist/webular.js, so the .js stays generated build output and
// the repo keeps no JavaScript source (tests/quality/typescript-only.test.ts).
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Console, Effect, FileSystem, Option } from 'effect'
import { exeName, hostFacts, packageName, targetFor } from '../core/platform.ts'

// hostFacts reads only /lib (the musl check), so a one-method file system runs it under Node.
const nodeFs = FileSystem.layerNoop({
  readDirectory: (path) => Effect.sync(() => (existsSync(path) ? readdirSync(path) : [])),
})

const run = (command: string, args: string[]) =>
  Effect.sync(() => spawnSync(command, args, { stdio: 'inherit' }))

// The child's exit code; a child killed by a signal kills this process the same way.
const exitOf = (result: ReturnType<typeof spawnSync>) =>
  Effect.sync(() => {
    if (result.signal) process.kill(process.pid, result.signal)
    return result.status ?? 1
  })

const main = Effect.gen(function* () {
  const argv = process.argv.slice(2)
  const facts = yield* hostFacts
  const target = targetFor(facts)
  const pkg = target ? packageName(target) : `webular-${facts.platform}-${facts.arch}`
  const native = target
    ? yield* Effect.option(
        Effect.try(() => createRequire(import.meta.url).resolve(`${pkg}/package.json`)),
      )
    : Option.none<string>()
  if (target && Option.isSome(native)) {
    const result = yield* run(join(dirname(native.value), 'bin', exeName(target)), argv)
    if (!result.error) return yield* exitOf(result)
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const bun = yield* run('bun', [join(root, 'bin', 'webular.ts'), ...argv])
  if (!bun.error) return yield* exitOf(bun)
  yield* Console.error(
    `webular: ${pkg} is not installed and Bun is not on PATH. Reinstall without omitting optional dependencies, or install Bun.`,
  )
  return 1
})

process.exitCode = Effect.runSync(main.pipe(Effect.provide(nodeFs)))
