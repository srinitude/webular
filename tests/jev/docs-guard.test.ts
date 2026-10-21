// Docs guard contracts, part one: limits come from the docs, the snapshot is proven, and
// every payload is checked before the call. CI replays the recorded docs;
// WEBULAR_JEV_DOCS_LIVE=1 (the scheduled job) compares against the live docs.
import { expect, test } from 'bun:test'
import { Config, Effect, FileSystem, Option } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { JEV_MODEL_DEFAULT } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { checkBody, committedSnapshot, httpFetcher } from '../../src/lib/jev/docs-guard.ts'
import { type DocsSnapshot, parseLimits, prove } from '../../src/lib/jev/docs-snapshot.ts'
import { violations } from '../../src/lib/jev/docs-violations.ts'
import { requestBytes } from '../../src/lib/jev/payload/index.ts'
import { docs, jev, noul, req, root, runFs } from './docs-guard-support.ts'

// The research payload for a whole state: one batch holding every sub-question.
const researchArg = (s: Parameters<typeof decisions.research>[0]) =>
  decisions.researchPart.def.payload({ s, part: s.subQuestions })
const nest = (n: number): unknown => (n === 0 ? 'leaf' : { a: nest(n - 1) })
const options = (n: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`o${i}`, null]))
const levels = (n: number) => Array.from({ length: n }, (_, i) => `level ${i}`)
const choiceQ = (n: number) => ({ q: { type: 'choice', instructions: 'i', criteria: options(n) } })
const scoreQ = (n: number) => ({ q: { type: 'score', instructions: 'i', criteria: levels(n) } })

test('limits are parsed from the docs text, not hard-coded', () =>
  runFs(
    Effect.map(docs, (text) => {
      expect(parseLimits(text)).toEqual({
        bodyBytes: 32 * 1024 * 1024,
        nesting: 64,
        choiceMax: 255,
        scoreMin: 2,
        scoreMax: 10,
        types: ['noul', 'choice', 'score', 'box'],
      })
      expect(parseLimits('no limits here')).toBeUndefined()
    }),
  ))

test('the committed snapshot proves the recorded docs: hash, line count, chunks to the last line', () =>
  runFs(
    Effect.map(docs, (text) => {
      const snap = prove('typesafe', String(jev.docs), text, committedSnapshot)
      expect(snap?.sha256).toBe(committedSnapshot.sha256)
      expect(snap?.lines).toBe(committedSnapshot.lines)
      expect(snap?.chunks.at(0)?.[0]).toBe(1)
      expect(snap?.chunks.at(-1)?.[1]).toBe(committedSnapshot.lines)
      expect(committedSnapshot.limits).toEqual(snap?.limits as DocsSnapshot['limits'])
    }),
  ))

test('live docs match the committed snapshot (scheduled job only)', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const live = yield* Config.option(Config.String('WEBULAR_JEV_DOCS_LIVE'))
      if (Option.getOrElse(live, () => '') !== '1') return
      const http = yield* HttpClient.HttpClient
      const r = yield* httpFetcher(http)(String(jev.docs), {})
      expect(prove('typesafe', String(jev.docs), r.text, r)?.sha256).toBe(committedSnapshot.sha256)
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  ))

test('each docs limit fails the payload before the call', () => {
  expect(violations(req(noul))).toEqual([])
  expect(violations(req(noul, { model: undefined }))[0]).toContain('model')
  expect(violations(req(noul, { model: 'gpt-x' }))[0]).toContain('model')
  expect(violations(req(choiceQ(255)))).toEqual([])
  expect(violations(req(choiceQ(256)))[0]).toContain('256 options')
  expect(violations(req(scoreQ(1)))[0]).toContain('1 levels')
  expect(violations(req(scoreQ(10)))).toEqual([])
  expect(violations(req(scoreQ(11)))[0]).toContain('11 levels')
  expect(violations(req({ q: { type: 'rank', instructions: 'i' } }))[0]).toContain('type rank')
  expect(violations(req(noul, { state: nest(64) }))).toEqual([])
  expect(violations(req(noul, { state: nest(65) }))[0]).toContain('nests past 64')
  expect(violations(req(noul, { state: { n: Number.NaN } }))[0]).toContain('finite')
  expect(violations(req({}))).toContain('questions empty')
  expect(violations(req(noul), { ...committedSnapshot.limits, bodyBytes: 10 }, 11)[0]).toContain(
    'body over',
  )
})

test('checkBody decodes the posted bytes and refuses a broken payload', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* checkBody(JSON.stringify(req(noul)))
      expect((yield* Effect.flip(checkBody('{not json'))).reason).toContain('not JSON')
      expect((yield* Effect.flip(checkBody(JSON.stringify(req({}))))).reason).toContain(
        'questions empty',
      )
    }),
  ))

test('every eval payload builder stays inside the docs limits', () =>
  Effect.runPromise(
    Effect.forEach(
      [
        decisions.link.def.payload({
          goal: 'find pricing',
          page: { url: 'https://a.example', title: 'A' },
          link: { url: 'https://a.example/p', anchor: 'Pricing' },
        }),
        decisions.change.def.payload({
          url: 'https://a.example',
          watchFor: 'price changes',
          diff: '- $5\n+ $6',
        }),
        researchArg({
          topic: 't',
          subQuestions: [{ question: 'q', bestEvidence: 'e' }],
          round: 1,
          maxRounds: 3,
        }),
      ],
      (p) => checkBody(requestBytes(JEV_MODEL_DEFAULT, p.state, p.questions)),
      { concurrency: 1, discard: true },
    ),
  ))

test('no Jev or decision-model call skips the docs guard', () =>
  runFs(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const files = (yield* fs.readDirectory(`${root}/src`, { recursive: true })).filter((f) =>
        f.endsWith('.ts'),
      )
      const bad: string[] = []
      for (const f of files) {
        const src = yield* fs.readFileString(`${root}/src/${f}`)
        if (/v1\/systemone|openrouter\.ai\/api/.test(src) && !src.includes('docs-guard'))
          bad.push(f)
      }
      expect(bad).toEqual([])
    }),
  ))
