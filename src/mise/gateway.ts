// The ONLY bridge from the CLI to executable logic: shell out to mise.
// The CLI never imports command/workflow code directly — every subcommand,
// flag and parameter is routed here as `mise run run:<command> -- <args>`.

export interface RunResult {
  exitCode: number
}

export async function runTask(task: string, args: string[]): Promise<RunResult> {
  const proc = Bun.spawn(['mise', 'run', task, '--', ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })
  const exitCode = await proc.exited
  return { exitCode }
}
