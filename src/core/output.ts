// clig.dev output discipline: machine data to stdout, logs to stderr,
// optional file sink via -o, structured JSON via --json. The -o file receives
// exactly what stdout would have carried.
import { outPath } from './safepath.ts'

export function logErr(msg: string): void {
  process.stderr.write(`${msg}\n`)
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface EmitOptions {
  json?: boolean
  output?: string
  render?: (data: unknown) => string
}

function defaultRender(data: unknown): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object' && 'markdown' in data) {
    return String((data as { markdown: unknown }).markdown)
  }
  return JSON.stringify(data, null, 2)
}

export async function emit(data: unknown, opts: EmitOptions): Promise<void> {
  const text = opts.json ? JSON.stringify(data, null, 2) : (opts.render ?? defaultRender)(data)
  if (opts.output) {
    await Bun.write(outPath(opts.output), text)
    return
  }
  process.stdout.write(`${text}\n`)
}
