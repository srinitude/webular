// Second hop on the bench riddle, from recorded live Wikipedia hits (no network): the
// bridge entity's page sits third, so the hop moves it to the lead with no extra round,
// because the answer step takes the lead hit's title as the entity of a nameless question.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { eff } from '../_support/run.ts'
import riddleTop from '../fixtures/wikipedia-uncertainty-riddle.json'

const riddle = 'In which city was the physicist who formulated the uncertainty principle born?'

test(
  'a bridge entity page already in the top hits leads',
  eff(
    Effect.gen(function* () {
      const calls: string[] = []
      const runSource: SourceRunner = (source, query) => {
        calls.push(query)
        return Effect.succeed(source === 'wikipedia' ? riddleTop : [])
      }
      const { results } = yield* searchEffect('web', riddle, 3, { hop: true, runSource })
      expect(results.map((h) => h.title)).toEqual([
        'Werner Heisenberg',
        'Uncertainty principle',
        'Pauli exclusion principle',
      ])
      expect(calls.every((q) => q === riddle)).toBe(true)
    }),
  ),
)
