// Shared subprocess runner: argv arrays only (no shell), mandatory timeout,
// and CONCURRENT stdout/stderr draining — a child that fills one pipe past
// 64KB while the parent awaits the other deadlocks, so both drain together.
interface ProcResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
}

interface ProcOptions {
  timeoutMs: number
  cwd?: string
  stdin?: string
}

export async function runProc(argv: [string, ...string[]], opts: ProcOptions): Promise<ProcResult> {
  // Our own timeout signal: `signal.aborted` distinguishes a real timeout from
  // a child that died to some other signal (SIGKILL/SIGSEGV are not timeouts).
  const timeout = AbortSignal.timeout(opts.timeoutMs)
  const proc = Bun.spawn(argv, {
    cwd: opts.cwd,
    stdin: opts.stdin === undefined ? 'ignore' : new TextEncoder().encode(opts.stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    signal: timeout,
    killSignal: 'SIGTERM',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, stdout, stderr, timedOut: timeout.aborted }
}
