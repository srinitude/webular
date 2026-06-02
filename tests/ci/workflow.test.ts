// CI/CD contract: local and remote CI share exactly one mise entrypoint,
// and mise can actually resolve the task graph (real behavior, no mocks).
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

describe('CI/CD wiring — one default dependency path, local and remote', () => {
  test('remote CI runs the single `mise run ci` default path', async () => {
    const yml = await Bun.file(`${ROOT}.github/workflows/ci.yml`).text()
    expect(yml).toContain('mise run ci')
    expect(yml).toContain('jdx/mise-action')
  })

  test('mise resolves the real task graph and lists capability commands', async () => {
    const proc = Bun.spawn(['mise', 'tasks', 'ls'], { cwd: ROOT })
    const out = await new Response(proc.stdout).text()
    await proc.exited
    expect(out).toContain('run:scrape')
    expect(out).toContain('ci')
  })
})
