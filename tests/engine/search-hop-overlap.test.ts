// The fact round of the second hop starts beside the entity round when the
// entity page's title is the entity itself, so the query stays as is. Order
// of the merged results stays the same, and a renamed query still waits.
import { expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { eff } from '../_support/run.ts'

const novel = 'One Hundred Years of Solitude'
const question = `Who wrote the novel ${novel}?`
// The entity round asks the title; a longer namesake page renames the fact query.
const entityName = novel
const namesake = `Novel ${novel}`
const film = {
  title: `${novel} (film)`,
  url: 'https://en.wikipedia.org/wiki/Love_in_the_Time_of_Cholera_(film)',
  description: '2007 film',
}
const author = {
  title: 'Gabriel García Márquez',
  url: 'https://en.wikipedia.org/wiki/Gabriel_Garc%C3%ADa_M%C3%A1rquez',
  description: 'Colombian writer',
}
const page = (title: string) => ({
  title,
  url: `https://en.wikipedia.org/wiki/${title.replaceAll(' ', '_')}`,
  description: `${novel} is a novel by Gabriel García Márquez`,
})

// Each wikipedia call sleeps 100 ms and records when it ran.
const recorded = (pageTitle: string) => {
  const spans: { query: string; start: number; end: number }[] = []
  const runSource: SourceRunner = (source, query) =>
    source !== 'wikipedia'
      ? Effect.succeed([])
      : Effect.gen(function* () {
          const start = yield* Clock.currentTimeMillis
          yield* Effect.sleep('100 millis')
          spans.push({ query, start, end: yield* Clock.currentTimeMillis })
          return query === question ? [film, author] : [page(pageTitle)]
        })
  return { spans, runSource }
}

test(
  'the fact round overlaps the entity round and order stays fixed',
  eff(
    Effect.gen(function* () {
      const { spans, runSource } = recorded(entityName)
      const { results } = yield* searchEffect('web', question, 3, { hop: true, runSource })
      expect(results.map((h) => h.title)).toEqual([entityName, film.title, author.title])
      const entity = spans.find((s) => s.query === entityName)
      const fact = spans.filter((s) => s.query === question)[1]
      expect(spans.length).toBe(3)
      expect(fact && entity && fact.start < entity.end).toBe(true)
    }),
  ),
)

test(
  'a renamed fact query runs after the entity round',
  eff(
    Effect.gen(function* () {
      const { spans, runSource } = recorded(namesake)
      yield* searchEffect('web', question, 3, { hop: true, runSource })
      const entity = spans.find((s) => s.query === entityName)
      const fact = spans.find((s) => s.query === question.replace(entityName, namesake))
      expect(fact && entity && fact.start >= entity.end).toBe(true)
    }),
  ),
)
