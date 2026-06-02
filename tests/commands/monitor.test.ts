// MONITOR contract — real fetch, temp db. Tests change-tracking behavior.
import { describe, expect, test } from 'bun:test'
import { unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname

async function runMonitor(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/monitor.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular monitor — change tracking across snapshots (real fetch)', () => {
  const dbPath = join(tmpdir(), `webular-monitor-test-${Date.now()}.db`)

  test('first run returns changeStatus "new"', async () => {
    const { code, out, err } = await runMonitor([
      '--url',
      'https://example.com',
      '--db',
      dbPath,
      '--json',
    ])
    expect(err).toBe('')
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.url).toBe('https://example.com')
    expect(data.changeStatus).toBe('new')
  }, 30_000)

  test('second run with same url returns changeStatus "same"', async () => {
    const { code, out, err } = await runMonitor([
      '--url',
      'https://example.com',
      '--db',
      dbPath,
      '--json',
    ])
    expect(err).toBe('')
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.changeStatus).toBe('same')
  }, 30_000)

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runMonitor(['--db', dbPath])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('cleanup db', () => {
    try {
      unlinkSync(dbPath)
    } catch {
      /* already gone */
    }
  })
})
