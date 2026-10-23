// The update notice: shown when the cached version is above the installed one,
// hidden for every off switch and for an equal or lower cached version. No network.
import { describe, expect, test } from 'bun:test'
import { type NoticeInput, noticeLine } from '../../src/cli/update-notice.ts'

const base: NoticeInput = {
  argv: ['scrape', 'https://a.b'],
  env: {},
  isTTY: true,
  current: '0.3.0',
}
const line = (over: Partial<NoticeInput>, latest = '0.4.0') =>
  noticeLine({ ...base, ...over }, latest, 'npm install -g webular@latest')

describe('update notice', () => {
  test('shows when the cache names a higher version', () => {
    expect(line({})).toBe(
      'A newer webular is out: 0.4.0 (you have 0.3.0). Run: npm install -g webular@latest',
    )
  })

  test.each<[string, Partial<NoticeInput>]>([
    ['WEBULAR_NO_UPDATE_NOTIFIER=1', { env: { WEBULAR_NO_UPDATE_NOTIFIER: '1' } }],
    ['CI', { env: { CI: 'true' } }],
    ['stderr not a TTY', { isTTY: false }],
    ['--json', { argv: ['scrape', '--json'] }],
    ['--ndjson', { argv: ['search', 'x', '--ndjson'] }],
    ['WEBULAR_AGENT_MODE=1', { env: { WEBULAR_AGENT_MODE: '1' } }],
    ['mcp command', { argv: ['mcp'] }],
    ['prerelease install', { current: '0.4.0-rc.1' }],
  ])('hides for %s', (_, over) => {
    expect(line(over)).toBeUndefined()
  })

  test('NO_COLOR does not hide it', () => {
    expect(line({ env: { NO_COLOR: '1' } })).toBeDefined()
  })

  test('hides when the cached version is equal, lower, or missing', () => {
    expect(line({}, '0.3.0')).toBeUndefined()
    expect(line({}, '0.2.9')).toBeUndefined()
    expect(noticeLine(base, undefined, 'x')).toBeUndefined()
  })
})
