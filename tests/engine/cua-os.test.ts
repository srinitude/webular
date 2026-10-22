// Per-OS paths of Cua browser mode (driver-cua.ts): how the browser's command
// line is read, and which --user-data-dir folders count as the user's own
// profile on macOS, Linux, and Windows.
import { describe, expect, test } from 'bun:test'
import { commandLineArgv, throwawayProfile } from '../../src/lib/driver-cua.ts'

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
