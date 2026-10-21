// Answer and research output must pass the readability chain: the Markdown
// check first, then the human-language check, with the text left as it was.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { readabilityChain, withReadability } from '../../src/lib/readability-chain.ts'

const sample = '# Report\n\nWe utilize tools. See [the notes](notes.md).\n'

test('the chain runs the markdown check, then the plain check, and keeps the text', () =>
  Effect.runPromise(
    Effect.map(readabilityChain(sample), ({ text, readability }) => {
      expect(text).toBe(sample)
      expect(Object.keys(readability)).toEqual(['markdown', 'plain'])
      expect(readability.markdown.join('\n')).toContain('missing local target notes.md')
      expect(readability.plain).toContain('filler: utilize')
    }),
  ))

test('withReadability adds findings and keeps every field', () =>
  Effect.runPromise(
    Effect.map(withReadability('report')({ topic: 't', report: '# Ok\n' }), (out) =>
      expect(out).toEqual({
        topic: 't',
        report: '# Ok\n',
        readability: { markdown: [], plain: [] },
      }),
    ),
  ))

const source = (name: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.readFileString(fileURLToPath(new URL(`../../src/workflows/${name}`, import.meta.url))),
  )

test('answer and research output go through the chain', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      // The answer workflow runs the chain as its own last step, after the Jev decision step.
      const answer = yield* source('answer.ts')
      expect(answer).toContain("withReadability('answer')")
      expect(answer).toContain('.then(synthStep)\n  .then(readabilityStep)')
      expect(yield* source('research.ts')).toContain("Effect.flatMap(withReadability('report'))")
    }).pipe(Effect.provide(BunServices.layer)),
  ))
