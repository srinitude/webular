// EXTRACT contract — CSS-selector extraction against the local fixture (no mocks).
// Tests the user-facing command behavior that `mise run run:extract` executes.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const runExtract = (args: string[]) => runCli('src/commands/extract.ts', args)

describe('webular extract — CSS-selector structured extraction (real fetch)', () => {
  test('extracts a named field from a fixture page with --fields', async () => {
    const { code, out } = await runExtract([
      '--url',
      `${fx.origin}/`,
      '--fields',
      'title:h1',
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.url).toBe(`${fx.origin}/`)
    expect(data.data.title).toBe('Fixture Home')
  }, 15_000)

  test('extracts multiple named fields with comma-separated --fields', async () => {
    const { code, out } = await runExtract([
      '--url',
      `${fx.origin}/`,
      '--fields',
      'title:h1,para:p',
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.data.title).toBe('Fixture Home')
    expect(typeof data.data.para).toBe('string')
    expect(data.data.para.length).toBeGreaterThan(0)
  }, 15_000)

  test('extracts matches array with --selector', async () => {
    const { code, out } = await runExtract(['--url', `${fx.origin}/`, '--selector', 'h1', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(Array.isArray(data.matches)).toBe(true)
    expect(data.matches[0]).toBe('Fixture Home')
  }, 15_000)

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runExtract(['--fields', 'title:h1'])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 when neither --fields nor --selector is provided', async () => {
    const { code, err } = await runExtract(['--url', `${fx.origin}/`])
    expect(code).toBe(2)
    expect(err).toContain('--fields')
  })
})
