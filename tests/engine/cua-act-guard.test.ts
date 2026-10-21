// act --goal refuses a browser window that is not on a throwaway or
// driver-owned profile, and fails closed when the command line cannot be read.
// Commands are recorded `ps -ww -o command=` lines; nothing runs live.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { actWindowAllowed, requireSafeActWindow } from '../../src/lib/cua-act-guard.ts'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OWN = '/Users/u/Library/Application Support/Google/Chrome'
const CALCULATOR = '/System/Applications/Calculator.app/Contents/MacOS/Calculator'

describe('act --goal refuses a browser without a throwaway profile', () => {
  test('a browser on its own default profile is refused', () => {
    expect(actWindowAllowed(`${CHROME} --user-data-dir=${OWN} --no-first-run`)).toBe(false)
    expect(actWindowAllowed(`${CHROME} --no-first-run`)).toBe(false)
    expect(actWindowAllowed('/usr/lib/firefox/firefox -profile /home/u/.mozilla')).toBe(false)
    expect(actWindowAllowed('/Applications/Safari.app/Contents/MacOS/Safari')).toBe(false)
  })

  test('an empty or unreadable command line is refused', () => {
    expect(actWindowAllowed('')).toBe(false)
    expect(actWindowAllowed('  \n')).toBe(false)
  })

  test('a pid that cannot be read fails closed', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const err = yield* Effect.flip(requireSafeActWindow(2_000_000_000))
        expect(err.message).toMatch(/pid 2000000000/)
      }),
    ))
})

describe('act --goal allows throwaway browsers and native apps', () => {
  test('a browser on a throwaway or driver-owned profile passes', () => {
    expect(actWindowAllowed(`${CHROME} --user-data-dir=/Users/u/webular --no-first-run`)).toBe(true)
    expect(
      actWindowAllowed(`${CHROME} --user-data-dir=/var/folders/x/T/cua-driver/profile-1 --x`),
    ).toBe(true)
  })

  test('a native app has no profile and passes', () => {
    expect(actWindowAllowed(CALCULATOR)).toBe(true)
  })
})
