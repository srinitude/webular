import { expect, test } from 'bun:test'
import { nameCountry } from '../../src/lib/answer-country.ts'

test('a country question names the country beside the demonym', () => {
  const answer = 'Maryna Viazovska is a Ukrainian mathematician.'
  expect(nameCountry('In which country was she born?', answer)).toContain('Ukraine)')
  expect(nameCountry('Who is she?', answer)).toBe(answer)
})
