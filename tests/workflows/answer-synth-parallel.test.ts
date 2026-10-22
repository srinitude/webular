// Latency contract: a reader waits for the answer's Jev calls once, not in a
// row. The lead sentence and figure calls start before the cite chain's first
// call (answer.followers) ends, so the synth step costs two Jev rounds, not four.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerFigure } from '../../src/lib/answer-figure.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { prepareSynth } from '../../src/workflows/answer-synth.ts'
import { eff } from '../_support/run.ts'

const page =
  'Madrid is the capital city of Spain. The city sits on the Manzanares river. ' +
  'Madrid has about 3.4 million people. It is the seat of the Spanish government.'
const image = { src: 'https://x.example/map.png', alt: 'Map of Spain', srcset: '', width: '400' }
const evidence = {
  query: 'What river runs through the Spanish capital?',
  sentences: 3,
  used: [
    {
      title: 'Madrid',
      url: 'https://x.example',
      text: page,
      images: [{ ...image, height: '300', caption: '' }],
    },
  ],
  errors: [],
}

test(
  'answer asks the lead sentence and figure alongside the cited sentences',
  eff(
    Effect.gen(function* () {
      const events: string[] = []
      const name = (d: unknown) =>
        d === decisions.answerSentence
          ? 'sentence'
          : d === decisions.answerFollowers
            ? 'followers'
            : d === answerFigure
              ? 'figure'
              : 'other'
      // Each call logs its start, yields to other fibers, then gives the fallback.
      const ask = (<I, A>(d: { readonly def: { readonly fallback: (i: I) => A } }, input: I) =>
        Effect.sync(() => events.push(`start ${name(d)}`)).pipe(
          Effect.andThen(Effect.yieldNow),
          Effect.andThen(Effect.yieldNow),
          Effect.andThen(Effect.sync(() => events.push(`end ${name(d)}`))),
          Effect.as(d.def.fallback(input)),
        )) as never
      const out = yield* prepareSynth(evidence, ask)
      expect(out.top.length).toBeGreaterThan(0)
      const followersEnd = events.indexOf('end followers')
      expect(followersEnd).toBeGreaterThan(-1)
      expect(events.indexOf('start sentence')).toBeLessThan(followersEnd)
      expect(events.indexOf('start figure')).toBeLessThan(followersEnd)
    }),
  ),
)
