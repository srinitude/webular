// Background-only contract for every Cua path: browser mode (driver-cua.ts)
// and native-app mode (act --goal through cua-ground and cua-ladder). It
// fails if Cua code calls a tool that takes focus, the clipboard, the
// keyboard, the real cursor, or sound, sets foreground delivery, or runs
// `open` without -g; and it pins the throwaway-profile guard of browser mode.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { throwawayProfile } from '../../src/lib/cua-profile.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const CUA_FILES = [
  'src/lib/driver-cua.ts',
  'src/lib/cua-goal.ts',
  'src/lib/cua-ground.ts',
  'src/lib/cua-jev.ts',
  'src/lib/cua-ladder.ts',
  'src/lib/cua-tree.ts',
  'src/commands/act.ts',
]

// Tools that run in the background on the exact target window.
const ALLOWED = new Set([
  'start_session',
  'end_session',
  'get_browser_state',
  'browser_navigate',
  'get_window_state',
  'page',
  'click',
  'verify_state',
  'parse_visual_regions',
])

const FORBIDDEN = [
  'bring_to_front',
  'escalate_session',
  'delivery_mode',
  'foreground',
  'clipboard',
  'hotkey',
  'press_key',
  'type_text',
  'move_cursor',
  'set_agent_cursor',
]

const code = (path: string) =>
  Effect.map(
    io(() => Bun.file(`${ROOT}${path}`).text()),
    (text) =>
      text
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n'),
  )

const allCode = Effect.map(Effect.forEach(CUA_FILES, code, { concurrency: 4 }), (texts) =>
  texts.join('\n'),
)

const LITERAL = /^'([a-z_]+)'$/

// First arguments of every cuaCall(...) / call(...) in the Cua code.
const toolArgs = (text: string) =>
  [...text.matchAll(/\b(?:cuaCall|call)\(\s*([^,)]+)/g)].map((m) => (m[1] ?? '').trim())

const checkAllowlist = (text: string) => {
  const args = toolArgs(text)
  const literal = args.flatMap((arg) => LITERAL.exec(arg)?.slice(1) ?? [])
  expect(literal.length).toBeGreaterThan(0)
  expect(literal.filter((tool) => !ALLOWED.has(tool))).toEqual([])
  // Only the pass-through wrappers forward a tool name they were given.
  expect(args.filter((arg) => !LITERAL.test(arg) && arg !== 'tool')).toEqual([])
}

const checkOpen = (text: string) => {
  const opens = [...text.matchAll(/\[\s*['"]open['"][^\]]*\]/g)].map((m) => m[0])
  expect(opens.filter((argv) => !/['"]-g['"]/.test(argv))).toEqual([])
}

describe('Cua background-only contract', () => {
  test(
    'Cua code names no focus, clipboard, keyboard, cursor, or foreground tool',
    eff(
      Effect.map(allCode, (text) => expect(FORBIDDEN.filter((w) => text.includes(w))).toEqual([])),
    ),
  )
  test(
    'every Cua tool call is a literal tool from the allowlist',
    eff(Effect.map(allCode, checkAllowlist)),
  )
  test('Cua code never runs open without -g', eff(Effect.map(allCode, checkOpen)))
  test(
    'act --goal opens its named session and always ends it',
    eff(
      Effect.map(code('src/commands/act.ts'), (text) => {
        expect(text).toMatch(/acquireUseRelease\(\s*cuaCall\('start_session'/)
        expect(text).toContain("cuaCall('end_session', { session })")
      }),
    ),
  )
  test('the scan catches a focus-taking call', () => {
    expect(() => checkAllowlist("cuaCall('bring_to_front', {})")).toThrow()
    expect(() => checkOpen("runProc(['open', '-a', 'Calculator'])")).toThrow()
    checkOpen("runProc(['open', '-g', '-a', 'Calculator'])")
  })
})

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

describe('browser mode runs only on a throwaway profile', () => {
  test('a separate --user-data-dir passes', () => {
    expect(throwawayProfile(`${CHROME} --user-data-dir=/Users/u/webular --no-first-run`)).toBe(true)
    expect(throwawayProfile(`${CHROME} --user-data-dir=/Users/u/My Profiles/cua`)).toBe(true)
  })
  test("the user's own browser is refused", () => {
    expect(throwawayProfile(CHROME)).toBe(false)
    expect(throwawayProfile(`${CHROME} --user-data-dir=`)).toBe(false)
    const own = `${CHROME} --user-data-dir=/Users/u/Library/Application Support/Google/Chrome`
    expect(throwawayProfile(own)).toBe(false)
    expect(throwawayProfile('')).toBe(false)
  })
})
