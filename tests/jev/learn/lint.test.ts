// Payload lint and lesson application: applyLessons adds a rule once; the lint
// names each rule a payload breaks; webular's own payloads and sources pass.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import type { JevRequest } from '../../../src/lib/jev/client.ts'
import { linkDecision } from '../../../src/lib/jev/decisions/crawl.ts'
import { changeDecision } from '../../../src/lib/jev/decisions/monitor.ts'
import { applyLessons } from '../../../src/lib/jev/learn/lessons.ts'
import { lintModel, lintPayload, sendsLatest } from '../../../src/lib/jev/learn/lint.ts'
import { instructionText, noul } from '../../../src/lib/jev/payload/index.ts'

test('applyLessons: data-only adds the data rule once', () => {
  const q = { type: 'noul', instructions: 'Is `x` a login page?' } as const
  const once = applyLessons({ state: {}, questions: { q } }, ['data-only', 'data-only'])
  expect(instructionText(once.questions['q']?.instructions ?? '').match(/as data/g)?.length).toBe(1)
})

test('lint: model pin, bare options, duplicates, and writing or math', () => {
  expect(lintModel('jev-latest').map((f) => f.rule)).toEqual(['model-pin'])
  expect(lintModel('jev-1.13.0')).toEqual([])
  const long = 'x'.repeat(50)
  const bad: JevRequest = {
    state: { a: long, b: { c: long } },
    questions: {
      lvl: { type: 'score', instructions: 'How severe is `a`?', criteria: ['low', 'high'] },
      sum: noul('Write a summary of `a`.'),
      twice: noul('Write a summary of `a`.'),
      fact: noul('Does `a` show only a view count?'),
    },
  }
  const rules = lintPayload(bad).map((f) => f.rule)
  expect(rules.filter((r) => r === 'structured-options').length).toBe(2)
  expect(rules.filter((r) => r === 'duplicate-part').length).toBe(2)
  expect(rules.filter((r) => r === 'not-a-judgment').length).toBe(2)
  expect(sendsLatest("const M = 'jev-latest'\n// the `jev-latest` alias\n")).toEqual([1])
})

// Real payloads: webular's own decisions pass the payload lint.
test('lint: webular decision payloads have no duplicate parts or writing steps', () => {
  const link = linkDecision.def.payload({
    goal: 'configure the CLI',
    page: { url: 'https://d.dev/', title: 'Docs' },
    link: { url: 'https://d.dev/config', anchor: 'Config' },
  })
  const change = changeDecision.def.payload({
    url: 'https://d.dev/p',
    watchFor: 'price',
    diff: '-Price: $49\n+Price: $59',
  })
  expect(lintPayload(link)).toEqual([])
  expect(lintPayload(change)).toEqual([])
})

// Real code: no source file sends the `jev-latest` alias.
test('lint: no webular source sends jev-latest', () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const root = `${import.meta.dir}/../../../src`
    const files = (yield* fs.readDirectory(root, { recursive: true })).filter((f) =>
      f.endsWith('.ts'),
    )
    const hits: string[] = []
    for (const f of files)
      for (const line of sendsLatest(yield* fs.readFileString(`${root}/${f}`)))
        hits.push(`src/${f}:${line}`)
    expect(hits).toEqual([])
  }).pipe(Effect.provide(BunServices.layer), Effect.runPromise))
