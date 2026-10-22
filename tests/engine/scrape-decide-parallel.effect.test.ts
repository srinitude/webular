// The scrape step's main-content pick and title pick run at once, so the title
// pick adds no wait: a fake Jev records how many asks are in flight together.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { scrapeDecide } from '../../src/workflows/scrape.ts'
import { eff } from '../_support/run.ts'

test('scrape asks the main and title picks concurrently', () => {
  let inFlight = 0
  let peak = 0
  const service = Jev.of({
    available: true,
    ask: () =>
      Effect.sync(() => {
        inFlight++
        peak = Math.max(peak, inFlight)
      }).pipe(
        Effect.andThen(Effect.sleep('30 millis')),
        Effect.ensuring(Effect.sync(() => inFlight--)),
        Effect.as({ answers: {}, inputTokens: 0 }),
      ),
  })
  const main = decisions.main.def.sample() as never
  const title = decisions.pageTitle.def.sample() as never
  return eff(
    Effect.ignore(scrapeDecide({ main, title })).pipe(
      Effect.provideService(Jev, service),
      Effect.andThen(Effect.sync(() => expect(peak).toBe(2))),
    ),
  )()
})
