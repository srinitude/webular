// Release step: writes the webular(1) manual page (mdoc) to dist/man/webular.1.
// Everything comes from the code itself: command names and descriptions from
// COMMANDS, global options from GLOBAL_OPTIONS, per-command flags from each
// command's option specs, version and homepage from package.json.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { COMMAND_NAMES, COMMANDS } from '../cli/commands.ts'
import { GLOBAL_OPTIONS } from '../cli/help.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

interface Flag {
  readonly name: string
  readonly value: boolean
}

interface ManInput {
  readonly version: string
  readonly homepage: string
  readonly date: string
  readonly globals: readonly (readonly [string, string])[]
  readonly flags: Readonly<Record<string, readonly Flag[]>>
}

// A text line must not start with '.' or "'" (roff control characters), and a
// backslash must be doubled.
const esc = (text: string): string => text.replaceAll('\\', '\\e').replace(/^(?=[.'])/, '\\&')

const SPEC = /'?([a-z][a-z-]*)'?: \{ type: '(string|boolean)'/g

const specFlags = (source: string): Flag[] =>
  [...source.matchAll(SPEC)].map((m) => ({ name: m[1] as string, value: m[2] === 'string' }))

// "  -o, --output <f>  Write the output" -> ["-o, --output <f>", "Write the output"]
const globalRows = (): (readonly [string, string])[] =>
  GLOBAL_OPTIONS.map((line) => {
    const [, left = '', right = ''] = /^\s*(.+?)\s{2,}(.+)$/.exec(line) ?? []
    return [left, right] as const
  })

const flagLine = ({ name, value }: Flag): string => `.Op Fl -${name}${value ? ' Ar value' : ''}`

const commandItem = (name: string, flags: readonly Flag[]): string[] => [
  `.It Cm ${name}`,
  esc(COMMANDS[name as keyof typeof COMMANDS]),
  ...(flags.length > 0
    ? ['.Pp', 'Options:', '.Bd -ragged -offset indent', ...flags.map(flagLine), '.Ed']
    : []),
]

const exitItems = [
  ['0', 'Success.'],
  ['1', 'Failure.'],
  ['2', 'Wrong usage.'],
  ['3', 'Some items failed (batch).'],
  ['127', 'A required tool is missing.'],
].flatMap(([code, text]) => [`.It Li ${code}`, text as string])

// Pure: the whole page as mdoc text.
const head = (input: ManInput): string[] => [
  `.Dd ${input.date}`,
  '.Dt WEBULAR 1',
  `.Os webular ${input.version}`,
  '.Sh NAME',
  '.Nm webular',
  '.Nd command line tool for web research',
  '.Sh SYNOPSIS',
  '.Nm',
  '.Ar command',
  '.Op Ar options',
  '.Sh DESCRIPTION',
  '.Nm',
  'searches, scrapes, crawls, maps, extracts, summarizes, and researches the web.',
  'Every command runs through a mise task.',
]

const body = (input: ManInput): string[] => [
  '.Sh COMMANDS',
  '.Bl -tag -width Ds',
  ...COMMAND_NAMES.flatMap((name) => commandItem(name, input.flags[name] ?? [])),
  '.El',
  '.Sh GLOBAL OPTIONS',
  '.Bl -tag -width Ds',
  ...input.globals.flatMap(([flag, text]) => [`.It Sy "${esc(flag)}"`, esc(text)]),
  '.El',
]

const tail = (input: ManInput): string[] => [
  '.Sh EXIT STATUS',
  '.Bl -tag -width Ds',
  ...exitItems,
  '.El',
  '.Sh SEE ALSO',
  '.Xr mise 1',
  '.Pp',
  'Homepage:',
  `.Lk ${input.homepage}`,
  '',
]

export const manpage = (input: ManInput): string =>
  [...head(input), ...body(input), ...tail(input)].join('\n')

const readFlags = (fs: FileSystem.FileSystem) =>
  Effect.forEach(
    COMMAND_NAMES,
    (cmd) =>
      fs
        .readFileString(join(PACKAGE_ROOT, 'src', 'commands', `${cmd}.ts`))
        .pipe(Effect.map((text) => [cmd, specFlags(text)] as const)),
    { concurrency: 8 },
  )

const longDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Writes <dir>/webular.1 and returns its path.
export const writeManpage = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const flags = Object.fromEntries(yield* readFlags(fs))
    const text = manpage({
      version: pkg.version,
      homepage: pkg.homepage,
      date: longDate(new Date()),
      globals: globalRows(),
      flags,
    })
    yield* fs.makeDirectory(dir, { recursive: true })
    const file = join(dir, 'webular.1')
    yield* fs.writeFileString(file, text)
    return file
  })

if (import.meta.main) {
  const main = writeManpage(join(PACKAGE_ROOT, 'dist', 'man'))
  BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
}
