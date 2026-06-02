// clig.dev output discipline: machine data to stdout, logs to stderr,
// optional file sink via -o, structured JSON via --json.

export function logErr(msg: string): void {
  process.stderr.write(`${msg}\n`)
}

function render(data: unknown): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object' && 'markdown' in data) {
    return String((data as { markdown: unknown }).markdown)
  }
  return JSON.stringify(data, null, 2)
}

export async function emit(
  data: unknown,
  opts: { json?: boolean; output?: string },
): Promise<void> {
  const text = opts.json ? JSON.stringify(data, null, 2) : render(data)
  if (opts.output) {
    await Bun.write(opts.output, text)
    return
  }
  process.stdout.write(`${text}\n`)
}
