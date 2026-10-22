// `webular mcp` command tools report progress when the caller asks for it, and
// stop at the per-call time limit with an isError result. Stand-in command
// files keep it hermetic. Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { connectedWith } from '../_support/mcp-client.ts'
import { eff, tmpDir } from '../_support/run.ts'

const standIns = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const dir = yield* tmpDir('webular-progress-')
  yield* fs.writeFileString(`${dir}/crawl.ts`, 'await Bun.sleep(300)\nconsole.log("{}")\n')
  yield* fs.writeFileString(`${dir}/tasks.ts`, 'await Bun.sleep(20_000)\n')
  return (command: string) => `${dir}/${command}.ts`
})

test(
  'a long command tool sends notifications/progress for a progressToken',
  eff(
    Effect.gen(function* () {
      const client = yield* connectedWith(yield* standIns)
      const seen: number[] = []
      const r = yield* Effect.promise(() =>
        client.callTool({ name: 'crawl', arguments: { url: 'https://example.com' } }, undefined, {
          onprogress: (p) => seen.push(p.progress),
        }),
      )
      expect(r.isError).toBeFalsy()
      expect(seen.length).toBeGreaterThanOrEqual(2)
      expect(seen.at(-1)).toBe(1)
    }),
  ),
)

test(
  'a command tool past its time limit returns isError',
  eff(
    Effect.gen(function* () {
      const client = yield* connectedWith(yield* standIns, '500 millis')
      const r = yield* Effect.promise(() => client.callTool({ name: 'tasks', arguments: {} }))
      expect(r.isError).toBe(true)
      expect(JSON.stringify(r.content)).toContain('time limit')
    }),
  ),
  10_000,
)
