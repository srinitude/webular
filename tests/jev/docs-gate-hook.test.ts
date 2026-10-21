// Contract for the repo-level jev-docs-gate hook: Jev files need a fresh, matching,
// complete docs proof; other files and the off switch always pass.

import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import {
  type Copy,
  gate,
  PROOF_TTL_MS,
  type Proof,
  type Receipt,
  receiptRefusal,
  savedCopy,
} from '../../.claude/hooks/jev-docs-gate-rule.ts'

const SHA = 'a'.repeat(64)
const receipt: Receipt = {
  session: 's1',
  decomposition: '/tmp/decomposition.json',
  decomposer: 'opus',
  pages_read: 274,
  url_count: 274,
  url_list_sha256: 'b'.repeat(64),
  llms_path: '/tmp/llms-full.txt',
  llms_bytes: 1047658,
  llms_sha256: SHA,
  llms_lines: 24598,
  fetched_at: '2026-10-21T05:47:00Z',
  lines_covered: 24598,
}
const copy: Copy = { bytes: 1047658, sha256: SHA, lines: 24598 }
const refuse = (r: Partial<Receipt>, c: Copy | undefined = copy, s = 's1', d = true) =>
  receiptRefusal({ ...receipt, ...r }, s, SHA, d, c)

test('a valid mod receipt for the same docs passes a Jev file with no repo proof', () => {
  expect(refuse({})).toBeUndefined()
  expect(gate('/repo/src/lib/jev/client.ts', undefined, SHA, 0, false, true)).toBeUndefined()
})

test('a mod receipt fails on other docs, gaps, unread pages, another session, or no decomposition', () => {
  expect(receiptRefusal(receipt, 's1', 'c'.repeat(64), true, copy)).toBe('receipt_mismatch')
  expect(refuse({ lines_covered: 24000 })).toBe('receipt_mismatch')
  expect(refuse({ pages_read: 130 })).toBe('receipt_mismatch')
  expect(refuse({}, copy, 's2')).toBe('receipt_mismatch')
  expect(refuse({}, copy, 's1', false)).toBe('receipt_mismatch')
  expect(refuse({ unreachable: 'docs down' })).toBe('receipt_mismatch')
})

test('malformed hashes or no bytes are malformed; no decomposer, time, or matching copy is unproven', () => {
  expect(refuse({ llms_sha256: 'ab' })).toBe('receipt_malformed')
  expect(refuse({ url_list_sha256: 'U'.repeat(64) })).toBe('receipt_malformed')
  expect(refuse({ llms_bytes: 0 }, undefined)).toBe('receipt_malformed')
  expect(refuse({ decomposer: undefined })).toBe('fetch_unproven')
  expect(refuse({ fetched_at: undefined })).toBe('fetch_unproven')
  expect(refuse({}, { ...copy, lines: 1 })).toBe('fetch_unproven')
})

// Each case writes its saved copy into its own scoped temp dir, deleted after.
const TEXT = 'line one\nline two\nline three'
const withCopy = (write: boolean, body: string) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'jev-receipt-' })
        if (write) yield* fs.writeFileString(`${dir}/llms-full.txt`, body)
        return yield* savedCopy(`${dir}/llms-full.txt`)
      }),
    ).pipe(Effect.provide(BunServices.layer)),
  )
const fresh = {
  llms_bytes: TEXT.length,
  llms_sha256: new Bun.CryptoHasher('sha256').update(TEXT).digest('hex'),
  llms_lines: 3,
  lines_covered: 3,
}
const check = (c: Copy | undefined) =>
  receiptRefusal({ ...receipt, ...fresh }, 's1', fresh.llms_sha256, true, c)

test('a fresh receipt whose saved copy matches bytes, hash, and lines is accepted', async () => {
  const c = await withCopy(true, TEXT)
  expect(c).toEqual({ bytes: fresh.llms_bytes, sha256: fresh.llms_sha256, lines: 3 })
  expect(check(c)).toBeUndefined()
  expect((await withCopy(true, `${TEXT}\n`))?.lines).toBe(3)
})

test('a receipt whose saved copy is missing or differs is refused as unproven', async () => {
  expect(check(await withCopy(false, TEXT))).toBe('fetch_unproven')
  expect(check(await withCopy(true, `${TEXT}!`))).toBe('fetch_unproven')
})

const now = 10 * PROOF_TTL_MS
const good: Proof = {
  sha256: SHA,
  lines: 24598,
  chunks: [
    [1, 8200],
    [8201, 16400],
    [16401, 24598],
  ],
  mappedAt: now,
  readAt: now,
}

test('non-Jev files and the off switch always pass', () => {
  expect(gate('src/core/cache.ts', undefined, SHA, now, false)).toBeUndefined()
  expect(gate('src/lib/jev/client.ts', undefined, SHA, now, true)).toBeUndefined()
})

test('a Jev file needs a fresh, matching proof that reaches the last line', () => {
  const jev = '/repo/src/lib/jev/client.ts'
  expect(gate(jev, good, SHA, now, false)).toBeUndefined()
  expect(gate('/repo/tests/jev/x.test.ts', undefined, SHA, now, false)).toContain(
    'no .claude/jev-docs-proof.json',
  )
  expect(gate(jev, good, 'c'.repeat(64), now, false)).toContain('sha256 differs')
  expect(
    gate(
      jev,
      {
        ...good,
        chunks: [
          [1, 8200],
          [8201, 16400],
        ],
      },
      SHA,
      now,
      false,
    ),
  ).toContain('last line')
  expect(
    gate(
      jev,
      {
        ...good,
        chunks: [
          [1, 8200],
          [8300, 24598],
        ],
      },
      SHA,
      now,
      false,
    ),
  ).toContain('last line')
  expect(gate(jev, { ...good, mappedAt: now - PROOF_TTL_MS - 1 }, SHA, now, false)).toContain(
    'older',
  )
  expect(gate(jev, { ...good, readAt: now - PROOF_TTL_MS - 1 }, SHA, now, false)).toContain('older')
})
