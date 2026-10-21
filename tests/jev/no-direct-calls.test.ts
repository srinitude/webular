// Enforcement: code outside src/lib/jev never asks Jev, calls a model, or posts to
// api.typesafe.ai by itself. The one door is defineDecision, and workflows and
// commands reach it through decisionStep or machineDecision.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'

// Banned in every file outside src/lib/jev, with no exceptions.
const ALWAYS: ReadonlyArray<readonly [string, RegExp]> = [
  ['asks the Jev service', /\.ask\(/],
  ['uses jevRuntime', /\bjevRuntime\b/],
  ['posts to Jev', /\bpostOnce\b|jev\/post(\.ts)?['"]/],
  ['talks to TypeSafe', /typesafe\.ai/],
  ['calls a model SDK', /@ai-sdk\/|from ['"]openai|@anthropic-ai\//],
  ['calls a model', /\b(generateText|streamText|systemone)\b|\.generate\(|\.stream\(/],
  ['builds a Mastra Agent', /@mastra\/core\/agent|new Agent\(/],
]
// Importing the Jev client is banned too, except in the files below. Each one only
// reads client state or constants; none of them asks Jev (ALWAYS still applies).
const CLIENT_IMPORT = /from ['"][^'"]*\bjev\/client(\.ts)?['"]/
const CLIENT_IMPORTERS: Readonly<Record<string, string>> = {
  // Reads `(yield* Jev).available` to skip the Jev checks when Jev is off.
  'workflows/scrape-fallback.ts': 'availability check only',
  // Reads `jev.available` before running the map.kind decision through its own def.
  'lib/crawl.ts': 'availability check only',
  // Imports the JEV_CONCURRENCY constant to cap its own fan-out.
  'lib/select.ts': 'constant only',
  // The recorder CLI provides Jev.live to read and label recorded calls.
  'commands/jev.ts': 'provides the live layer to the recorder CLI',
}

// Files that may load a model SDK, and only that ('calls a model SDK'); every
// other ALWAYS rule still applies.
const MODEL_SDK_LOADERS: Readonly<Record<string, string>> = {
  // The Stately agent planner: @statelyai/agent takes an AI SDK model object
  // (WEBULAR_AGENT_MODEL=anthropic:... or openai:...), which defineDecision, a
  // Jev-only door, cannot stand in for. Its Jev provider goes through lib/jev/answers.ts.
  'machines/agent-model.ts': 'Stately agent planner needs an AI SDK model',
}

const isCode = (line: string) => !/^\s*(\/\/|\*|\/\*)/.test(line)
const offences = (file: string, text: string) => {
  const code = text.split('\n').filter(isCode).join('\n')
  const bad = ALWAYS.filter(
    ([why, re]) => re.test(code) && !(why === 'calls a model SDK' && file in MODEL_SDK_LOADERS),
  ).map(([why]) => why)
  if (CLIENT_IMPORT.test(code) && !(file in CLIENT_IMPORTERS)) bad.push('imports the Jev client')
  return bad.map((why) => `${file}: ${why}`)
}

const outsideJev = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const root = `${import.meta.dir}/../../src`
  const files = (yield* fs.readDirectory(root, { recursive: true })).filter(
    (f) => f.endsWith('.ts') && !f.startsWith('lib/jev/'),
  )
  const texts = yield* Effect.forEach(files, (f) => fs.readFileString(`${root}/${f}`), {
    concurrency: 16,
  })
  return files.flatMap((f, i) => offences(f, texts[i] ?? ''))
}).pipe(Effect.provide(BunServices.layer))

test('nothing outside src/lib/jev asks Jev, calls a model, or posts to TypeSafe', () =>
  Effect.runPromise(outsideJev.pipe(Effect.map((bad) => expect(bad).toEqual([])))))

test('the rules flag each kind of direct call, and spare comments and allowed files', () => {
  expect(offences('a.ts', 'const r = yield* jev.ask("d", req)')).toHaveLength(1)
  expect(offences('a.ts', 'jevRuntime.runPromise(x)')).toHaveLength(1)
  expect(offences('a.ts', "import { postOnce } from './jev/post.ts'")).toHaveLength(1)
  expect(offences('a.ts', 'fetch("https://api.typesafe.ai/v1")')).toHaveLength(1)
  expect(offences('a.ts', "import { openai } from '@ai-sdk/openai'")).toHaveLength(1)
  expect(offences('a.ts', 'await agent.generate("hi")')).toHaveLength(1)
  expect(offences('a.ts', "import { Jev } from './jev/client.ts'")).toEqual([
    'a.ts: imports the Jev client',
  ])
  expect(offences('lib/select.ts', "import { X } from './jev/client.ts'")).toEqual([])
  expect(offences('a.ts', '// uses jev.ask( here')).toEqual([])
})

test('every allowlisted file exists and still imports the client', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      for (const f of Object.keys(CLIENT_IMPORTERS)) {
        const text = yield* fs.readFileString(`${import.meta.dir}/../../src/${f}`)
        expect([f, CLIENT_IMPORT.test(text)]).toEqual([f, true])
      }
    }).pipe(Effect.provide(BunServices.layer)),
  ))
