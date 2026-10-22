// Coverage gate: every command in src/commands, and every MCP tool, has a
// model scenario that runs on every surface. A new command with no scenario
// (or a scenario narrowed to fewer surfaces) fails here, in the default path.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { ROOT } from '../_support/root.ts'
import { loadScenarios } from './scenarios.ts'

// Commands a paid-model scenario cannot grade offline, each with its reason.
const EXEMPT: Readonly<Record<string, string>> = {
  mcp: 'serves the MCP tools every scenario already calls; it is the transport, not a capability',
  act: 'drives a real browser or Cua window, which no fixture can replay',
}

const Tools = Schema.fromJsonString(
  Schema.Struct({ tools: Schema.Record(Schema.String, Schema.Unknown) }),
)

test('every command and MCP tool has a scenario on every surface', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const file = yield* loadScenarios
      const commands = (yield* fs.readDirectory(`${ROOT}src/commands`))
        .filter((f) => f.endsWith('.ts'))
        .map((f) => f.slice(0, -3))
      const tools = Object.keys(
        (yield* Effect.flatMap(
          fs.readFileString(`${ROOT}plugins/webular/src/descriptions.json`),
          Schema.decodeUnknownEffect(Tools),
        )).tools,
      )
      const covered = new Set(file.scenarios.map((s) => s.tool))
      const missing = [...new Set([...commands, ...tools])]
        .filter((c) => !(c in EXEMPT) && !covered.has(c))
        .sort()
      const narrowed = file.scenarios
        .filter((s) => s.surfaces && s.surfaces.length < file.surfaces.length)
        .map((s) => s.id)
      const stale = Object.keys(EXEMPT).filter((c) => !commands.includes(c))
      const unrecorded = yield* Effect.filter(
        file.scenarios.map((s) => s.id),
        (id) => Effect.map(fs.exists(`${ROOT}tests/models/baseline/${id}.txt`), (e) => !e),
      )
      expect({ missing, narrowed, stale, unrecorded }).toEqual({
        missing: [],
        narrowed: [],
        stale: [],
        unrecorded: [],
      })
    }).pipe(Effect.provide(BunServices.layer)),
  ))
