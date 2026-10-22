// The research hop: a question becomes keywords, and the hits' bridge entity
// (a name the topic does not hold) becomes the next search.
import { describe, expect, test } from 'bun:test'
import { bridgeEntity, keywordQuery } from '../../src/lib/jev/decisions/research.ts'

const topic =
  'In which city was the first person to win Nobel Prizes in two different sciences born?'

describe('research hop', () => {
  test('a wh- question loses its lead and its question mark', () => {
    expect(keywordQuery(topic)).toBe(
      'the first person to win Nobel Prizes in two different sciences born',
    )
    expect(keywordQuery('Who founded Bun?')).toBe('Who founded Bun')
  })

  test('the bridge is the name the hits add, not one the topic holds', () => {
    const hits = [
      'Despite these factors, Marie Curie is to date the only person awarded Nobel Prizes in two different sciences.',
      'The Nobel Prizes are awarded yearly. Marie Curie won in 1903.',
    ]
    expect(bridgeEntity(topic, hits)).toBe('Marie Curie')
    expect(bridgeEntity(topic, ['Nobel Prizes are given each year.'])).toBeUndefined()
  })
})
