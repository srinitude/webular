// The jev-docs-gate decision, pure, so its contract test needs no process, plus the
// one reader of a receipt's saved llms-full.txt copy.
// Two proofs pass: the repo proof (.claude/jev-docs-proof.json: saved copy, line
// count, chunk boundaries that reach the last line, plus when the firecrawl_map and
// the full read ran), or a valid decision-models-first mod receipt for the same
// llms-full.txt, so a session holding a mod receipt never reads the docs twice.
// Situations: a receipt is keyed by situation. An agent names its situation on its first
// action with a `JEV-SITUATION: <name>` line; later actions stay bound to it. A Jev edit
// without one is refused as situation_missing, and a receipt whose fetch belongs to
// another situation or agent as borrowed_fetch.
import { Effect, FileSystem } from 'effect'

export const PROOF_TTL_MS = 60 * 60 * 1000
export interface Proof {
  readonly sha256: string
  readonly lines: number
  readonly chunks: ReadonlyArray<readonly [number, number]>
  readonly mappedAt: number // epoch ms of the fresh firecrawl_map of docs.typesafe.ai
  readonly readAt: number // epoch ms the last chunk reader finished
}
// ~/.local/state/decision-models-first/receipts/<session>/<situation>.json, as the
// mod's bin/decision-models-receipt writes it.
export interface Receipt {
  readonly session: string
  readonly decomposition: string
  readonly decomposer?: string | undefined
  readonly pages_read: number
  readonly url_count: number
  readonly url_list_sha256: string
  readonly llms_path?: string | undefined
  readonly llms_bytes: number
  readonly llms_sha256: string
  readonly llms_lines: number
  readonly fetched_at?: string | undefined
  readonly lines_covered: number
  readonly unreachable?: string | undefined
  readonly situation?: string | undefined // the situation whose fetch this receipt proves
  readonly agent?: string | undefined // the agent that made the fetch, when the mod records it
}
// Who is editing: the bound situation and the agent id ('main' for the primary agent).
export interface Who {
  readonly situation: string
  readonly agent: string
}
// What the saved copy at llms_path really holds.
export interface Copy {
  readonly bytes: number
  readonly sha256: string
  readonly lines: number
}
export const isJevPath = (path: string) => /(^|\/)(src\/lib\/jev|tests\/jev)\//.test(path)
const covers = (p: Proof) =>
  p.chunks[0]?.[0] === 1 &&
  p.chunks.at(-1)?.[1] === p.lines &&
  p.chunks.every((c, i) => i === 0 || c[0] === (p.chunks[i - 1]?.[1] ?? 0) + 1)
const HEX64 = /^[0-9a-f]{64}$/

// Checked before any file read: a malformed receipt never touches the disk.
export const receiptMalformed = (r: Receipt) =>
  !HEX64.test(r.llms_sha256) || !HEX64.test(r.url_list_sha256) || !(r.llms_bytes > 0)

const fetchProven = (r: Receipt, copy: Copy | undefined) =>
  !!r.decomposer &&
  !!r.fetched_at &&
  copy !== undefined &&
  copy.bytes === r.llms_bytes &&
  copy.sha256 === r.llms_sha256 &&
  copy.lines === r.llms_lines

const SITUATION_LINE = /^JEV-SITUATION:[ \t]*([A-Za-z0-9_-]{1,64})[ \t]*$/m
export const declaredSituation = (text: string) => SITUATION_LINE.exec(text)?.[1]
// The first action binds; every later action keeps the bound situation.
export const situationOf = (declared: string | undefined, bound: string | undefined) => bound ?? declared
export const SITUATION_MISSING =
  'situation_missing: the first action of this agent needs a `JEV-SITUATION: <name>` line naming its situation'
export const receiptBorrowed = (r: Receipt, who: Who) =>
  r.situation !== who.situation || (r.agent !== undefined && r.agent !== who.agent)

// undefined accepts; a string is the refusal code. The mod writer already checks
// subtasks and helpers; this adds the same docs (llms_sha256 equals the committed
// snapshot) and a saved copy that proves the receipt's own fetch.
// Like the mod, a receipt has no expiry inside its session.
export const receiptRefusal = (
  r: Receipt,
  session: string,
  snapshotSha: string,
  decompositionExists: boolean,
  copy: Copy | undefined,
  who?: Who,
) => {
  if (receiptMalformed(r)) return 'receipt_malformed'
  if (who !== undefined && receiptBorrowed(r, who)) return 'borrowed_fetch'
  if (!fetchProven(r, copy)) return 'fetch_unproven'
  const ok =
    r.session === session &&
    r.unreachable === undefined &&
    r.llms_sha256 === snapshotSha &&
    r.llms_lines > 0 &&
    r.lines_covered === r.llms_lines &&
    r.url_count > 0 &&
    r.pages_read === r.url_count &&
    decompositionExists
  return ok ? undefined : 'receipt_mismatch'
}

// Line count = newlines, plus 1 when the text has no trailing newline.
const copyOf = (bytes: Uint8Array): Copy => {
  let newlines = 0
  for (const b of bytes) if (b === 10) newlines++
  const tail = bytes.length > 0 && bytes[bytes.length - 1] !== 10 ? 1 : 0
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  return { bytes: bytes.length, sha256, lines: newlines + tail }
}

// Reads the saved copy once; a missing path or file is undefined.
export const savedCopy = (path: string | undefined) =>
  path === undefined
    ? Effect.succeed(undefined)
    : Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return copyOf(yield* fs.readFile(path))
      }).pipe(Effect.orElseSucceed(() => undefined))

const proofReason = (proof: Proof | undefined, snapshotSha: string, now: number) => {
  if (proof === undefined)
    return 'no .claude/jev-docs-proof.json and no valid decision-models-first receipt: map docs.typesafe.ai and read all of llms-full.txt first'
  if (proof.sha256 !== snapshotSha)
    return 'proof sha256 differs from src/lib/jev/docs-snapshot.json: run mise run jev:docs, then read the docs again'
  if (!covers(proof)) return 'proof chunks do not run from line 1 to the last line'
  if (now - proof.mappedAt > PROOF_TTL_MS || now - proof.readAt > PROOF_TTL_MS)
    return 'proof is older than an hour: map and read the docs again'
  return undefined
}

// undefined allows; a string is the deny reason. receipt: true passes; 'borrowed_fetch'
// means the situation's receipt belongs to another situation or agent, so it never passes.
export const gate = (
  path: string,
  proof: Proof | undefined,
  snapshotSha: string,
  now: number,
  off: boolean,
  receipt: boolean | 'borrowed_fetch' = false,
) => {
  if (off || receipt === true || !isJevPath(path)) return undefined
  const why = proofReason(proof, snapshotSha, now)
  return why !== undefined && receipt === 'borrowed_fetch'
    ? `borrowed_fetch: the receipt for this situation belongs to another situation or agent; ${why}`
    : why
}
