// A comma inside a URL survives the trip from an MCP tool call to the CLI, and
// every command's --help describes its flags from the same zod schemas the MCP
// tools use. Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { toFlags } from '../../plugins/webular/src/commands.ts'
import { EXAMPLES } from '../../src/cli/commands.ts'
import { listFlag } from '../../src/core/args.ts'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const withComma = 'https://x.com/a,b'

test('toFlags repeats a list flag, one URL per flag', () => {
  expect(toFlags({ urls: [withComma, 'https://y.com'] })).toEqual([
    `--urls=${withComma}`,
    '--urls=https://y.com',
  ])
})

test('a repeated --urls keeps commas inside URLs; the comma list still works', () => {
  expect(listFlag([withComma, 'https://y.com'])).toEqual([withComma, 'https://y.com'])
  expect(listFlag(withComma)).toEqual([withComma])
  expect(listFlag('https://a.com, https://b.com')).toEqual(['https://a.com', 'https://b.com'])
  expect(listFlag(undefined)).toBeUndefined()
})

test(
  'scrape --help describes each flag and its example matches the usage line',
  eff(
    Effect.gen(function* () {
      const { out: stdout } = yield* runCli('src/commands/scrape.ts', ['--help'])
      expect(stdout).toContain('--url <value>')
      expect(stdout).toContain('Full http or https URL')
      expect(stdout).toContain('Render the page in a browser first')
      expect(stdout).toContain('--ignore-robots')
      expect(EXAMPLES.scrape).not.toContain('--url')
    }),
  ),
)
