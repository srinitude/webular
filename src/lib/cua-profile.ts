// The throwaway-profile guard shared by Cua render (driver-cua.ts) and act
// --goal (cua-act-guard.ts): read a browser's command line and refuse any
// window whose --user-data-dir is missing or one of the browsers' defaults.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect } from 'effect'
import { runProc } from '../core/proc.ts'
import { driverError } from './driver.ts'

// The browsers' default profile folders on macOS, Linux (expanded home), and
// Windows. Matched on every OS, case-insensitive, after backslashes become slashes.
const DEFAULT_PROFILE =
  /\/(Library\/Application Support\/(Google\/Chrome|Chromium|Microsoft Edge|BraveSoftware\/Brave-Browser)|\.config\/(google-chrome|chromium|microsoft-edge|BraveSoftware\/Brave-Browser)|AppData\/Local\/(Google\/Chrome|Chromium|Microsoft\/Edge|BraveSoftware\/Brave-Browser)\/User Data)\/*$/i

// `command` is the browser's full command line (`ps -o command=` or the Windows
// CommandLine); a quoted --user-data-dir keeps its spaces and loses its quotes.
export const throwawayProfile = (command: string) => {
  const m = /--user-data-dir=(?:"([^"]*)"|(.+?)(?= --|$))/.exec(command.trim())
  const dir = (m?.[1] ?? m?.[2])?.trim()
  return dir !== undefined && dir !== '' && !DEFAULT_PROFILE.test(dir.replace(/\\/g, '/'))
}

// Windows has no `ps`, and .NET's Process cannot read another process's
// arguments, so Win32_Process.CommandLine it is. Console.Out.Write skips the
// formatter's line wrap; -NonInteractive turns a prompt into an error, not a hang.
export const commandLineArgv = (os: string, pid: number): [string, ...string[]] =>
  os === 'win32'
    ? [
        'powershell',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `[Console]::Out.Write((Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine)`,
      ]
    : ['ps', '-ww', '-o', 'command=', '-p', String(pid)]

// A cold Windows PowerShell start (.NET Framework plus the CIM module) can
// outlast one try, so only a timeout gets one more. A probe that still fails
// (timeout, spawn error, nonzero exit) is its own error, never a "not
// throwaway" verdict, and the guard still refuses.
export const readCommandLine = (
  pid: number,
  argv = commandLineArgv(process.platform, pid),
  timeoutMs = 10_000,
) => {
  const timedOut = `timed out after ${timeoutMs} ms`
  return Effect.flatMap(
    Effect.mapError(runProc(argv, { timeoutMs }), (err) => err.message),
    (res) =>
      res.timedOut
        ? Effect.fail(timedOut)
        : res.code === 0
          ? Effect.succeed(res.stdout)
          : Effect.fail(res.stderr.trim() || `exit ${res.code}`),
  ).pipe(
    Effect.retry({ times: 1, while: (why) => why === timedOut }),
    Effect.mapError((why) =>
      driverError('cua', `could not read the command line of pid ${pid}: ${why}`),
    ),
    Effect.provide(BunServices.layer),
  )
}

// `command` is a seam for tests; it defaults to the real probe.
export const requireThrowaway = (pid: number, command = readCommandLine(pid)) =>
  Effect.flatMap(command, (line) =>
    throwawayProfile(line)
      ? Effect.void
      : Effect.fail(
          driverError('cua', `pid ${pid} is not a throwaway browser profile (--user-data-dir)`),
        ),
  )
