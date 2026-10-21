// Outcome: a contributor session edits Jev files (src/lib/jev, tests/jev) only after
// it mapped docs.typesafe.ai and read all of llms-full.txt, proven by
// .claude/jev-docs-proof.json matching the committed snapshot, or by a valid
// decision-models-first receipt for the same llms-full.txt in this session.
// PreToolUse on Edit|Write|MultiEdit, timeout 5 s. Off switch: WEBULAR_JEV_DOCS_GATE=off
// or the file .claude/.jev-docs-gate-off. A hook fault allows: the gate never breaks a session.
// One receipt per situation: an agent names its situation on its first action with a
// `JEV-SITUATION: <name>` line, bound per agent; a Jev edit without one is refused as
// situation_missing, and a receipt from another situation or agent as borrowed_fetch.
// After 3 denials an agent's edits pass, each one logged as a row in
// ~/.local/state/webular-jev-docs-gate/violations.jsonl, so no agent gets stuck.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Clock, Config, Console, Effect, FileSystem, Option, Schema, Stdio, Stream } from 'effect'
import {
  declaredSituation,
  gate,
  isJevPath,
  type Receipt,
  receiptMalformed,
  receiptRefusal,
  SITUATION_MISSING,
  savedCopy,
  situationOf,
  type Who,
} from './jev-docs-gate-rule.ts'

const root = `${import.meta.dir}/../..`
const STATE = '.local/state/decision-models-first'
const MAX_DENIALS = 3
const Input = Schema.fromJsonString(
  Schema.Struct({
    session_id: Schema.optional(Schema.String),
    agent_id: Schema.optional(Schema.String),
    tool_input: Schema.Struct({
      file_path: Schema.optional(Schema.String),
      content: Schema.optional(Schema.String),
      new_string: Schema.optional(Schema.String),
      command: Schema.optional(Schema.String),
      edits: Schema.optional(
        Schema.Array(Schema.Struct({ new_string: Schema.optional(Schema.String) })),
      ),
    }),
  }),
)
const ProofJson = Schema.fromJsonString(
  Schema.Struct({
    sha256: Schema.String,
    lines: Schema.Number,
    chunks: Schema.Array(Schema.Tuple([Schema.Number, Schema.Number])),
    mappedAt: Schema.Number,
    readAt: Schema.Number,
  }),
)
const ReceiptJson = Schema.fromJsonString(
  Schema.Struct({
    session: Schema.String,
    decomposition: Schema.String,
    decomposer: Schema.optional(Schema.String),
    pages_read: Schema.Number,
    url_count: Schema.Number,
    url_list_sha256: Schema.String,
    llms_path: Schema.optional(Schema.String),
    llms_bytes: Schema.Number,
    llms_sha256: Schema.String,
    llms_lines: Schema.Number,
    fetched_at: Schema.optional(Schema.String),
    lines_covered: Schema.Number,
    unreachable: Schema.optional(Schema.String),
    situation: Schema.optional(Schema.String),
    agent: Schema.optional(Schema.String),
  }),
)
const Binding = Schema.fromJsonString(Schema.Struct({ situation: Schema.String }))
const Snap = Schema.fromJsonString(Schema.Struct({ sha256: Schema.String }))
// The mod's safe_name: any character outside A-Za-z0-9_- becomes _, capped at 200.
const safeName = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200)

// A malformed receipt reads no file; otherwise the saved copy is read once.
const refusalOf = (r: Receipt, session: string, sha: string, who: Who) =>
  Effect.gen(function* () {
    if (receiptMalformed(r)) return 'receipt_malformed'
    const d = yield* (yield* FileSystem.FileSystem).exists(r.decomposition)
    return receiptRefusal(r, session, sha, d, yield* savedCopy(r.llms_path), who)
  })

// One receipt per situation: <session>/<situation>.json. true passes, 'borrowed_fetch' is
// a receipt from another situation or agent, false is none or any other refusal.
const hasReceipt = (session: string, sha: string, who: Who) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const home = yield* Config.String('HOME')
    const file = `${home}/${STATE}/receipts/${safeName(session)}/${safeName(who.situation)}.json`
    const r = yield* Schema.decodeUnknownEffect(ReceiptJson)(yield* fs.readFileString(file))
    const refusal = yield* refusalOf(r, session, sha, who)
    return refusal === undefined ? true : refusal === 'borrowed_fetch' ? 'borrowed_fetch' : false
  }).pipe(Effect.orElseSucceed(() => false as boolean | 'borrowed_fetch'))

// The agent's bound situation (read), or its first declared one (bound and saved).
// A failed read or write only means no binding: the hook never breaks a session.
const bindSituation = (session: string, agent: string, declared: string | undefined) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = `${yield* Config.String('HOME')}/${STATE}/bindings/${safeName(session)}`
    const file = `${dir}/${safeName(agent)}.json`
    const bound = yield* fs.readFileString(file).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Binding)),
      Effect.map((b) => b.situation),
      Effect.orElseSucceed(() => undefined),
    )
    if (bound === undefined && declared !== undefined)
      yield* fs
        .makeDirectory(dir, { recursive: true })
        .pipe(
          Effect.andThen(fs.writeFileString(file, JSON.stringify({ situation: declared }))),
          Effect.ignore,
        )
    return situationOf(declared, bound)
  }).pipe(Effect.orElseSucceed(() => declared))

const deny = (reason: string) =>
  Console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `jev-docs-gate: ${reason}`,
      },
    }),
  )

// Denies and counts, per session and agent. Past MAX_DENIALS the edit passes and appends
// a violation row instead. A failed count read or write still denies.
const denyOrPass = (session: string, agent: string, path: string, reason: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = `${yield* Config.String('HOME')}/.local/state/webular-jev-docs-gate`
    const counts = `${dir}/denials/${safeName(session)}`
    const file = `${counts}/${safeName(agent)}`
    const count = yield* fs.readFileString(file).pipe(
      Effect.map((s) => Number(s) || 0),
      Effect.orElseSucceed(() => 0),
    )
    if (count < MAX_DENIALS) {
      yield* fs
        .makeDirectory(counts, { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(file, String(count + 1))), Effect.ignore)
      return yield* deny(reason)
    }
    const row = { session, agent, path, reason, at: yield* Clock.currentTimeMillis }
    yield* fs
      .writeFileString(`${dir}/violations.jsonl`, `${JSON.stringify(row)}\n`, { flag: 'a' })
      .pipe(Effect.ignore)
  }).pipe(Effect.catch(() => deny(reason)))

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const stdio = yield* Stdio.Stdio
  const raw = yield* stdio.stdin.pipe(Stream.decodeText(), Stream.mkString)
  const input = yield* Schema.decodeUnknownEffect(Input)(raw)
  const path = input.tool_input.file_path ?? ''
  const env = Option.getOrElse(
    yield* Config.option(Config.String('WEBULAR_JEV_DOCS_GATE')),
    () => '',
  )
  const off = env === 'off' || (yield* fs.exists(`${root}/.claude/.jev-docs-gate-off`))
  const proof = yield* fs.readFileString(`${root}/.claude/jev-docs-proof.json`).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(ProofJson)),
    Effect.orElseSucceed(() => undefined),
  )
  const snap = yield* Schema.decodeUnknownEffect(Snap)(
    yield* fs.readFileString(`${root}/src/lib/jev/docs-snapshot.json`),
  )
  const ti = input.tool_input
  const text = [
    ti.content,
    ti.new_string,
    ti.command,
    ...(ti.edits ?? []).map((e) => e.new_string),
  ].join('\n')
  const session = input.session_id ?? ''
  const agent = input.agent_id ?? 'main'
  const situation = yield* bindSituation(session, agent, declaredSituation(text))
  if (!off && isJevPath(path) && situation === undefined)
    return yield* denyOrPass(session, agent, path, SITUATION_MISSING)
  const receipt =
    situation && session ? yield* hasReceipt(session, snap.sha256, { situation, agent }) : false
  const reason = gate(path, proof, snap.sha256, yield* Clock.currentTimeMillis, off, receipt)
  if (reason !== undefined) yield* denyOrPass(session, agent, path, reason)
})

BunRuntime.runMain(main.pipe(Effect.ignore, Effect.provide(BunServices.layer)))
