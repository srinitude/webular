// Per-OS paths of Cua browser mode (cua-profile.ts): how the browser's command
// line is read, and which --user-data-dir folders count as the user's own
// profile on macOS, Linux, and Windows.
import { describe, expect, test } from 'bun:test'
import { Duration, Effect } from 'effect'
import {
  commandLineArgv,
  readCommandLine,
  requireThrowaway,
  throwawayProfile,
} from '../../src/lib/cua-profile.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const WIN_CHROME = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
const quoted = (dir: string) => `${WIN_CHROME} --user-data-dir="${dir}" --no-first-run`

describe('the command line is read per OS', () => {
  test('darwin and linux use ps, win32 uses PowerShell', () => {
    const ps: [string, ...string[]] = ['ps', '-ww', '-o', 'command=', '-p', '42']
    expect(commandLineArgv('darwin', 42)).toEqual(ps)
    expect(commandLineArgv('linux', 42)).toEqual(ps)
    expect(commandLineArgv('win32', 42)).toEqual([
      'powershell',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "[Console]::Out.Write((Get-CimInstance Win32_Process -Filter 'ProcessId=42').CommandLine)",
    ])
  })
})

const DEFAULTS = [
  '/Users/u/Library/Application Support/Chromium',
  '/Users/u/Library/Application Support/Microsoft Edge/',
  '/home/u/.config/google-chrome',
  '/home/u/.config/chromium/',
  '/home/u/.config/microsoft-edge',
  '/home/u/.config/BraveSoftware/Brave-Browser/',
  'C:\\Users\\u\\AppData\\Local\\Google\\Chrome\\User Data',
  'C:\\Users\\u\\AppData\\Local\\Chromium\\User Data\\',
  'c:/users/u/appdata/local/microsoft/edge/user data',
  'C:\\Users\\u\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
]

describe('each OS default browser profile is refused', () => {
  test.each(DEFAULTS)('refuses %s', (dir) => {
    expect(throwawayProfile(`/usr/bin/browser --user-data-dir=${dir} --flag`)).toBe(false)
    expect(throwawayProfile(quoted(dir))).toBe(false)
  })
  test('a throwaway dir passes on every OS', () => {
    expect(throwawayProfile('/usr/bin/chromium --user-data-dir=/home/u/.config/webular --x')).toBe(
      true,
    )
    expect(throwawayProfile(quoted('C:\\Users\\u\\AppData\\Local\\webular\\User Data'))).toBe(true)
    expect(throwawayProfile(`${WIN_CHROME} --user-data-dir="D:\\My Profiles\\cua"`)).toBe(true)
  })
  test('an empty quoted dir is refused', () => {
    expect(throwawayProfile(`${WIN_CHROME} --user-data-dir=""`)).toBe(false)
  })
})

// A probe that cannot read the command line (a slow cold start, a missing
// binary) is reported as that, not as "not a throwaway profile", and still refuses.
const failure = (probe: Effect.Effect<void, Error>) =>
  Effect.map(Effect.flip(probe), (err) => err.message)

describe('a failed command line probe is its own error', () => {
  test(
    'a probe that never answers times out twice, then refuses with the timeout',
    eff(
      Effect.gen(function* () {
        const sleeper = [process.execPath, `${ROOT}tests/engine/cua-fake-browser.ts`] as const
        const [took, msg] = yield* Effect.timed(
          failure(requireThrowaway(7, readCommandLine(7, [...sleeper], 200))),
        )
        expect(msg).toBe('could not read the command line of pid 7: timed out after 200 ms')
        expect(Duration.toMillis(took)).toBeGreaterThanOrEqual(400)
      }),
    ),
    20_000,
  )
  test(
    'a probe that cannot start refuses with the spawn error, without a retry',
    eff(
      Effect.gen(function* () {
        const msg = yield* failure(requireThrowaway(7, readCommandLine(7, ['webular-no-probe'])))
        expect(msg).toStartWith('could not read the command line of pid 7: ')
        expect(msg).not.toContain('throwaway')
      }),
    ),
  )
  test(
    'a probe that reads a command line still judges the profile',
    eff(
      Effect.gen(function* () {
        const msg = yield* failure(
          requireThrowaway(7, readCommandLine(7, [process.execPath, '--version'])),
        )
        expect(msg).toBe('pid 7 is not a throwaway browser profile (--user-data-dir)')
      }),
    ),
  )
})
