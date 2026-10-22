// Nested country questions bridge through the fetched page text: the country
// the inner clause names becomes the subject of the outer question. Fixed
// page excerpts, no network; distractor countries sit beside the bridge.
import { expect, test } from 'bun:test'
import { nestedBridge } from '../../src/lib/search-nested.ts'

const cases = [
  {
    query: 'What is the capital city of the country that hosted the 2016 Summer Olympics?',
    want: 'What is the capital city of Brazil?',
    pages: [
      'The 2016 Summer Olympics, officially the Games of the XXXI Olympiad, was an international multi-sport event held from 5 to 21 August 2016 in Rio de Janeiro, Brazil. Rio de Janeiro took a significant lead over Madrid, heading into the final round.',
      'The 2028 Summer Olympics will be the fifth Summer Olympics hosted by the United States. Los Angeles hosted the Summer Olympics in 1932 and 1984.',
    ],
  },
  {
    query:
      "What is the capital city of the country whose team won the 2023 FIFA Women's World Cup?",
    want: 'What is the capital city of Spain?',
    pages: [
      "The 2023 FIFA Women's World Cup was the ninth edition, co-hosted by Australia and New Zealand. The opening match was won by co-host New Zealand on 20 July 2023. Spain became the first country to hold both the men's and women's World Cup titles, having won the Women's World Cup in 2023.",
      "United States women's national soccer team is the most successful team in the Women's World Cup, having won four titles.",
    ],
  },
]

for (const c of cases)
  test(`a nested question bridges through the page text: ${c.want}`, () => {
    expect(nestedBridge(c.query, c.pages)).toBe(c.want)
  })

test('a plain question has no bridge', () => {
  expect(
    nestedBridge('What is the capital city of Brazil?', ['Brasilia is the capital of Brazil.']),
  ).toBeUndefined()
})
