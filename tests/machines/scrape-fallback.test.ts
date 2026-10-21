// Model-based test: every path of the scrape-fallback machine, replayed against
// the real withFallbacks. The render paths run in a child process whose PATH
// starts with a stub `agent-browser` (a recorded page, or a failure), so no
// browser starts. The PDF paths use a real local server.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { scrapeFallbackMachine } from '../../src/machines/scrape-fallback.ts'
import { withFallbacks } from '../../src/workflows/scrape-fallback.ts'
import { finalPaths } from '../_support/paths.ts'
import { ROOT } from '../_support/root.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

const dir = `${import.meta.dir}/../fixtures/driver`
const text = (name: string) => Effect.promise(() => Bun.file(`${dir}/${name}`).text())
const PROSE = `<html><body><p>${'Plain server-rendered prose. '.repeat(20)}</p></body></html>`
const URL_ = 'https://x.test/'
type Scenario = Parameters<typeof eff>[0]

const CHILD = `import { Effect } from 'effect'
import { withFallbacks } from './src/workflows/scrape-fallback.ts'
const html = await Bun.file(process.argv[1]).text()
const page = await Effect.runPromise(withFallbacks('${URL_}', Effect.succeed({ html }), 'agent-browser'))
console.log(JSON.stringify(page))`

// The shell page rendered in a child whose `agent-browser` is the given stub script.
const renderWithStub = (stub: string) =>
  Effect.gen(function* () {
    const stubs = yield* tmpDir('webular-stub-')
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString(`${stubs}/agent-browser`, stub, { mode: 0o755 })
    const env: [string, ...string[]] = ['env', `PATH=${stubs}:${process.env['PATH']}`, 'bun', '-e']
    const { stdout } = yield* runProc([...env, CHILD, `${dir}/spa-shell.html`], {
      timeoutMs: 30_000,
      cwd: ROOT,
    })
    return JSON.parse(stdout) as { html: string; renderedBy?: string }
  })

// The fallback for a fetch refused as a PDF, which then reads from a local server.
const pdfFallback = (status: number) =>
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          port: 0,
          fetch: () =>
            status === 200
              ? new Response(Bun.file(`${dir}/attention.pdf`))
              : new Response('gone', { status }),
        }),
      ),
      (s) => Effect.promise(() => s.stop(true)),
    )
    const url = `http://localhost:${server.port}/p.pdf`
    return withFallbacks(url, Effect.fail(new Error(`fetch ${url}: "application/pdf"`)), 'off')
  }).pipe(Effect.flatten)

const FETCHED_SCENARIOS: Record<string, Scenario> = {
  'FETCHED STATIC_PAGE': Effect.gen(function* () {
    const page = yield* withFallbacks(URL_, Effect.succeed({ html: PROSE }), 'agent-browser')
    expect(page).toEqual({ html: PROSE })
  }),
  'FETCHED SHELL_RENDER_OFF': Effect.gen(function* () {
    const html = yield* text('spa-shell.html')
    expect(yield* withFallbacks(URL_, Effect.succeed({ html }), 'off')).toEqual({ html })
  }),
  'FETCHED SHELL_RENDER_ON RENDER_OK': Effect.gen(function* () {
    const stub = `#!/bin/sh\ncat >/dev/null\ncat ${dir}/agent-browser-raw.txt\n`
    const page = yield* renderWithStub(stub)
    expect(page.renderedBy).toBe('agent-browser')
    expect(page.html).toContain('AURORA-7')
  }),
  'FETCHED SHELL_RENDER_ON RENDER_FAILED': Effect.gen(function* () {
    const page = yield* renderWithStub('#!/bin/sh\ncat >/dev/null\nexit 1\n')
    expect(page).toEqual({ html: yield* text('spa-shell.html') })
  }),
}

const OTHER_SCENARIOS: Record<string, Scenario> = {
  'PDF_REFUSED PDF_OK': Effect.gen(function* () {
    const page = yield* pdfFallback(200)
    expect('markdown' in page ? page.markdown : '').toContain('scaled dot-product attention')
  }),
  'PDF_REFUSED PDF_FAILED': Effect.gen(function* () {
    expect(yield* failMsg(pdfFallback(404))).toContain('status 404')
  }),
  FETCH_FAILED: Effect.gen(function* () {
    const fetched = Effect.fail(new Error('network down'))
    expect(yield* failMsg(withFallbacks(URL_, fetched, 'agent-browser'))).toBe('network down')
  }),
}

const SCENARIOS = { ...FETCHED_SCENARIOS, ...OTHER_SCENARIOS }

const paths = finalPaths(scrapeFallbackMachine, [
  ...['FETCHED', 'PDF_REFUSED', 'FETCH_FAILED', 'STATIC_PAGE', 'SHELL_RENDER_OFF'],
  ...['SHELL_RENDER_ON', 'RENDER_OK', 'RENDER_FAILED', 'PDF_OK', 'PDF_FAILED'],
])

describe('scrape fallback machine matches withFallbacks', () => {
  test('the model has one scenario per path', () => {
    expect(paths.map((p) => p.events.join(' ')).sort()).toEqual(Object.keys(SCENARIOS).sort())
  })

  test.each(paths.map((p) => [`${p.final}: ${p.events.join(' ')}`, p] as const))(
    '%s',
    (_name, path) => eff(SCENARIOS[path.events.join(' ')] ?? Effect.die('no scenario'))(),
    60_000,
  )
})
