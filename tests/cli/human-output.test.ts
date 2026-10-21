// Human output contract: the color rule, safe web text, width wrap, "did you
// mean", and failure lines that name a next step. Unit checks, then real runs
// of bin/webular.ts on a pipe. The terminal half runs through the same pure
// functions with a terminal flag and width, since subprocesses go through
// effect/process, which has no PTY.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { helpText } from '../../src/cli/help.ts'
import { renderFor } from '../../src/cli/render.ts'
import { type ColorEnv, closest, safeText, useColor, wrap } from '../../src/cli/style.ts'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)
const colors = (over: Partial<ColorEnv>): ColorEnv => ({
  noColor: '',
  forceColor: '',
  term: 'xterm-256color',
  ...over,
})

// PATH and HOME come through Effect Config; each run adds only what it tests.
// Windows names them Path and USERPROFILE.
const baseEnv = Effect.all({
  PATH: Config.String('PATH').pipe(Config.orElse(() => Config.String('Path'))),
  HOME: Config.String('HOME').pipe(Config.orElse(() => Config.String('USERPROFILE'))),
})
const piped = (args: string[], extra: Record<string, string> = {}) =>
  Effect.flatMap(baseEnv, (base) =>
    runCli('bin/webular.ts', args, { env: { ...base, ...extra }, exec: process.execPath }),
  )

// One payload that fills every field any renderer reads with terminal escapes.
const EVIL = '\x1b]0;owned\x07'
const evilItem = { title: EVIL, url: EVIL, description: EVIL, error: EVIL, name: EVIL }
const evilPayload = Object.fromEntries([
  ...['markdown', 'report', 'summary', 'answer', 'action', 'url', 'savedTo', 'changeStatus']
    .concat(['diff', 'command', 'snapshot', 'screenshot', 'published'])
    .map((key) => [key, EVIL]),
  ...['results', 'pages', 'checks', 'items', 'sources'].map((key) => [key, [evilItem]]),
  ...['links', 'matches', 'tasks', 'diagrams', 'tools'].map((key) => [key, [EVIL]]),
])
const CONTROL = /(?![\t\n])\p{Cc}/u

describe('useColor — NO_COLOR, FORCE_COLOR, TERM, and the stream', () => {
  test('NO_COLOR wins over FORCE_COLOR', () => {
    expect(useColor(true, colors({ noColor: '1', forceColor: '1' }))).toBe(false)
    expect(useColor(false, colors({ forceColor: '1' }))).toBe(true)
    expect(useColor(true, colors({ forceColor: '0' }))).toBe(false)
  })

  test('TERM=dumb and a pipe mean no color', () => {
    expect(useColor(true, colors({ term: 'dumb' }))).toBe(false)
    expect(useColor(false, colors({}))).toBe(false)
    expect(useColor(true, colors({}))).toBe(true)
  })
})

describe('safeText — web text never drives the terminal', () => {
  test('escapes control characters and keeps tabs, newlines, and CRLF', () => {
    expect(safeText('a\x1b[2Jb\x07\x9b\x7f')).toBe('a\\x1b[2Jb\\x07\\x9b\\x7f')
    expect(safeText('one\ttwo\r\nthree\rfour')).toBe('one\ttwo\r\nthree\\x0dfour')
    expect(safeText('left‮right')).toBe('left\\u{202e}right')
  })

  test('every command renderer escapes fetched strings', () => {
    for (const name of COMMAND_NAMES) {
      const render = renderFor(name)
      expect(render?.(evilPayload)).not.toMatch(CONTROL)
      expect(render?.({ data: { key: EVIL } })).not.toMatch(CONTROL)
      expect(render?.(EVIL)).not.toMatch(CONTROL)
    }
  })
})

describe('wrap — terminal width, whole lines on a pipe', () => {
  test('wraps past the width and indents the rows that follow', () => {
    const line = '  answer     Answer a question from web sources with cited links'
    const rows = wrap(line, 13, 40).split('\n')
    for (const row of rows) expect(row.length).toBeLessThanOrEqual(40)
    expect(rows[1]).toStartWith(' '.repeat(13))
    expect(wrap(line, 13, Number.POSITIVE_INFINITY)).toBe(line)
  })

  test('help wraps in a 40-column terminal and keeps whole lines on a pipe', () => {
    for (const row of helpText(40).split('\n')) expect(row.length).toBeLessThanOrEqual(40)
    const whole = helpText(Number.POSITIVE_INFINITY).split('\n')
    expect(whole.some((row) => row.length > 40)).toBe(true)
  })

  test('help names user next steps and every exit code', () => {
    const help = helpText(Number.POSITIVE_INFINITY)
    expect(help).toContain("Run 'webular <command> --help'")
    expect(help).not.toContain('mise run')
    expect(help).toContain('128+n')
  })
})

describe('did you mean — unknown commands', () => {
  test('closest finds a near command name', () => {
    expect(closest('scrap', COMMAND_NAMES)).toBe('scrape')
    expect(closest('serch', COMMAND_NAMES)).toBe('search')
    expect(closest('zzzzzzzz', COMMAND_NAMES)).toBeUndefined()
  })

  test(
    'an unknown command suggests the closest one and prints nothing to stdout',
    eff(
      Effect.gen(function* () {
        const run = yield* piped(['scrap'])
        expect(run.code).toBe(2)
        expect(run.out).toBe('')
        expect(run.err).toContain("Did you mean 'scrape'?")
        expect(run.err).not.toContain('\x1b[')
        expect((yield* piped(['scrap'], { FORCE_COLOR: '1' })).err).toContain('\x1b[31merror:')
        const both = yield* piped(['scrap'], { FORCE_COLOR: '1', NO_COLOR: '1' })
        expect(both.err).not.toContain('\x1b[')
      }),
    ),
    20_000,
  )
})

describe('failure lines name a next step', () => {
  test(
    'a failed fetch says what to try next',
    eff(
      Effect.gen(function* () {
        const run = yield* piped(['scrape', '--url', `${fx.origin}/missing-page-404`])
        expect(run.code).toBe(1)
        expect(run.err).toContain('scrape: failed')
        expect(run.err).toContain('webular doctor')
      }),
    ),
    30_000,
  )
})
