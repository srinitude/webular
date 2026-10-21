// MONITOR command entry — invoked by `mise run run:monitor`. Parses flags,
// runs the Mastra monitor workflow, emits the result. No mise logic here.
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { Effect, FileSystem, Path } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { errMsg } from '../core/output.ts'
import { outPath, sandboxEnabled } from '../core/safepath.ts'

// Per-user, per-project default (keyed by realpath of the INVOKING directory —
// the gateway pins process cwd to the package root). A tmpdir default would
// share one single-writer sqlite file across every user on the host.
const defaultDbPath = Effect.fn('monitor.defaultDbPath')(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const stateHome = process.env['XDG_STATE_HOME'] ?? path.join(homedir(), '.local', 'state')
  const project = yield* fs.realPath(process.env['WEBULAR_INVOKE_DIR'] ?? process.cwd())
  const key = createHash('sha256').update(project).digest('hex').slice(0, 12)
  const dir = path.join(stateHome, 'webular')
  yield* fs.makeDirectory(dir, { recursive: true })
  return path.join(dir, `monitor-${key}.db`)
})

const toCliError = (cause: unknown) =>
  new CliError({ message: errMsg(cause), exitCode: EXIT.failure })

const resolveDbPath = Effect.fn('monitor.resolveDbPath')(function* (flagValue: unknown) {
  if (typeof flagValue === 'string' && flagValue.length > 0) return flagValue
  if (process.env['WEBULAR_DB']) return process.env['WEBULAR_DB']
  if (yield* sandboxEnabled()) return 'webular-monitor.db'
  return yield* defaultDbPath().pipe(Effect.mapError(toCliError))
})

// The path work touches the disk (realpath, mkdir) and the sandbox check can
// reject the path; both surface as a CliError with exit code 1.
const dbPathFor = (flagValue: unknown) =>
  resolveDbPath(flagValue).pipe(Effect.flatMap((p) => outPath(p).pipe(Effect.mapError(toCliError))))

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    db: { type: 'string' },
  })
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    const message = 'monitor: missing <url>. Pass --url <url> or put the URL after the command.'
    return yield* new CliError({ message, exitCode: EXIT.usage })
  }
  const inputData = {
    url,
    dbPath: yield* dbPathFor(values['db']),
    timeoutMs: yield* timeoutFlag('monitor', values),
  }
  return yield* runWorkflow(
    'monitor',
    () => import('../workflows/monitor.ts'),
    (m) => m.monitorWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
