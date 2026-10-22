// act --goal guard: the same throwaway-profile rule that render follows
// (cua-profile.ts requireThrowaway), applied to the window act will click in.
// A browser window must run a throwaway or driver-owned profile
// (--user-data-dir outside the browsers' default folders); a native app has no
// profile, so it passes. A command line that cannot be read fails closed.
import { Effect } from 'effect'
import { readCommandLine, throwawayProfile } from './cua-profile.ts'
import { driverError } from './driver.ts'

// Matched on the executable part only (before the first ` --flag`).
const BROWSER = /chrom|msedge|microsoft edge|brave|firefox|safari|opera|vivaldi|\/arc\b/i

export const actWindowAllowed = (command: string) => {
  const exe = command.trim().split(' --')[0] ?? ''
  return exe !== '' && (!BROWSER.test(exe) || throwawayProfile(command))
}

export const requireSafeActWindow = (pid: number) =>
  Effect.flatMap(readCommandLine(pid), (command) =>
    actWindowAllowed(command)
      ? Effect.void
      : Effect.fail(
          driverError(
            'cua',
            `pid ${pid} is not a throwaway or driver-owned browser profile, or its command line is empty`,
          ),
        ),
  )
