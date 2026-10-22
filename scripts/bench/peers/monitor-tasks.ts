// Monitor gold: a fixture page that reads "ten" on its first fetch and
// "twelve" on every later one. Two fetches of /monitor must report a change.
import type { Task } from './model.ts'

const page = (n: string) =>
  new Response(
    `<!doctype html><html><head><title>Fixture</title></head><body><main><article><h1>Stock Count</h1><p>The warehouse holds ${n} crates.</p></article></main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )

export const monitorRoute = (): (() => Response) => {
  let fetches = 0
  return () => page(fetches++ === 0 ? 'ten' : 'twelve')
}

export const monitorTasks: readonly Task[] = [
  {
    id: 'monitor-fixture-edit',
    job: 'monitor',
    suite: 'monitor',
    localOnly: true,
    input: { url: '{fixture}/monitor' },
    checks: [{ kind: 'regex', values: ['"changeStatus":"changed"'] }],
  },
]
