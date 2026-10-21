// jevOrder ranks the links that map and crawl cut at their limit. With Jev off
// the incoming order stands, so WEBULAR_JEV=off output matches the unranked path.
import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { jevOrder } from '../../src/lib/crawl.ts'
import { Jev } from '../../src/lib/jev/client.ts'
import { JevError } from '../../src/lib/jev/errors.ts'
import { eff } from '../_support/run.ts'

const urls = ['https://x.test/login', 'https://x.test/a', 'https://x.test/tag/b']
const order = (available: boolean, ask: Jev['Service']['ask']) =>
  jevOrder({ site: 'https://x.test/', urls }).pipe(
    Effect.provide(Layer.succeed(Jev)(Jev.of({ available, ask }))),
  )

describe('jevOrder', () => {
  test(
    'Jev off keeps the incoming order, junk included, and asks nothing',
    eff(
      Effect.gen(function* () {
        let asked = 0
        const out = yield* order(false, () => {
          asked++
          return Effect.die('no call expected')
        })
        expect(out).toEqual(urls)
        expect(asked).toBe(0)
      }),
    ),
  )

  test(
    'Jev on with failing answers keeps a permutation of every URL',
    eff(
      Effect.gen(function* () {
        const down = () => Effect.fail(new JevError({ reason: 'down', kind: 'network' }))
        const out = yield* order(true, down)
        expect([...out].sort()).toEqual([...urls].sort())
      }),
    ),
  )
})
