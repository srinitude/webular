// Background driver contract: recorded back-end output parses, every session
// closes on success and on failure, the state stream reports each phase, and
// scrape's PDF route reads a served PDF. No test starts a browser or sends any
// input: back ends run on recorded stdout fixtures in tests/fixtures/driver/.
import { describe, expect, test } from 'bun:test'
import { Effect, Fiber, Stream } from 'effect'
import { htmlFromAgentBrowser, makeDriver, type Steps } from '../../src/lib/driver.ts'
import { cuaTarget, idsFromBind, textFromPage } from '../../src/lib/driver-cua.ts'
import { needsJs, withFallbacks } from '../../src/workflows/scrape-fallback.ts'

const dir = `${import.meta.dir}/../fixtures/driver`
const fixture = (name: string) => Effect.promise(() => Bun.file(`${dir}/${name}`).text())

describe('back-end output parsing (recorded fixtures)', () => {
  test('agent-browser raw and JSON-string html both yield markup', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const raw = yield* htmlFromAgentBrowser(yield* fixture('agent-browser-raw.txt'))
        const quoted = yield* htmlFromAgentBrowser(yield* fixture('agent-browser-json.txt'))
        expect(raw.startsWith('<html')).toBe(true)
        expect(quoted).toBe(raw)
      }),
    ))

  test('cua bind result gives target and tab ids; page get_text gives text', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const ids = yield* idsFromBind(yield* fixture('cua-bind.json'))
        expect(ids).toEqual({ target_id: 't-1', tab_id: 'tab-9' })
        const text = yield* textFromPage(yield* fixture('cua-page-text.txt'))
        expect(text).toContain('AURORA-7')
        const wrapped = yield* textFromPage(JSON.stringify({ text: 'from json' }))
        expect(wrapped).toBe('from json')
        expect((yield* Effect.exit(textFromPage('  ')))._tag).toBe('Failure')
      }),
    ))

  test('the installed cua-driver names the tab as the active entry of tabs', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* idsFromBind(yield* fixture('cua-bind-tabs.json'))).toEqual({
          target_id: 'bt-6d347ba7-a24b-47ae-9d81-df7f152feaa1',
          tab_id: 'tab-8785d649-20ea-4875-a7b6-1ece39980a8e',
        })
        const refused = JSON.stringify({ status: 'refused', refusal: { code: 'x' } })
        expect((yield* Effect.exit(idsFromBind(refused)))._tag).toBe('Failure')
      }),
    ))

  test('cua target must be named explicitly as pid:window_id', () => {
    expect(cuaTarget('123:456')).toEqual({ pid: 123, window_id: 456 })
    expect(cuaTarget(undefined)).toBeUndefined()
    expect(cuaTarget('active')).toBeUndefined()
  })
})

describe('agent-browser blank page', () => {
  // A blank render must read as empty so the scrape keeps the fetched page.
  test('markup with no text yields empty html', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* htmlFromAgentBrowser('"<head></head><body></body>"')).toBe('')
      }),
    ))

  // Without its root, linkedom reads an empty body and the render's text is lost.
  test('a render printed without its html root gets the root back', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const inner = '<head><title>T</title></head><body><p>AURORA-7</p></body>'
        expect(yield* htmlFromAgentBrowser(JSON.stringify(inner))).toBe(`<html>${inner}</html>`)
      }),
    ))
})

const fakeSteps = (closed: string[], readFails: boolean): Steps => ({
  open: (url) => Effect.succeed(url),
  read: () => (readFails ? Effect.die('read failed') : Effect.succeed('<html>ok</html>')),
  close: (opened) => Effect.sync(() => void closed.push(String(opened))),
})

const firstPhases = (state: Stream.Stream<{ phase: string }>, n: number) =>
  Stream.runFold(
    Stream.take(state, n),
    () => '',
    (acc, s) => (acc ? `${acc},${s.phase}` : s.phase),
  )

describe('session lifecycle', () => {
  test('render closes the session and streams every phase', () => {
    const closed: string[] = []
    return Effect.runPromise(
      Effect.gen(function* () {
        const driver = yield* makeDriver('agent-browser', fakeSteps(closed, false))
        // The stream starts with the current state, so a late viewer sees it at once.
        const watch = yield* Effect.forkChild(firstPhases(driver.state, 4))
        yield* Effect.yieldNow
        expect((yield* driver.render('https://x.test/')).html).toBe('<html>ok</html>')
        expect(yield* Fiber.join(watch)).toBe('idle,opening,reading,closed')
        expect(closed).toEqual(['https://x.test/'])
      }),
    )
  })

  test('a failed read still closes the session', () => {
    const closed: string[] = []
    return Effect.runPromise(
      Effect.gen(function* () {
        const driver = yield* makeDriver('cua', fakeSteps(closed, true))
        const exit = yield* Effect.exit(driver.render('https://y.test/'))
        expect(exit._tag).toBe('Failure')
        expect(closed).toEqual(['https://y.test/'])
      }),
    )
  })
})

describe('render fallback trigger', () => {
  test('a script shell with no text needs JavaScript; a real article does not', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(needsJs(yield* fixture('spa-shell.html'))).toBe(true)
        const prose = `<html><body><p>${'Plain server-rendered prose. '.repeat(20)}</p></body></html>`
        expect(needsJs(prose)).toBe(false)
      }),
    ))

  // example.com ships one analytics script and two short sentences: a full
  // page, not a shell, so it must not wait on a cold browser.
  test('a short static page with real sentences and a script needs no render', () => {
    const page =
      '<html><head><script src=/s.js></script></head><body><div><h1>Example Domain</h1>' +
      '<p>This domain is for use in documentation examples without needing permission.</p>' +
      '<p><a href="https://iana.org/domains/example">Learn more</a></p></div></body></html>'
    expect(needsJs(page)).toBe(false)
  })

  // An app shell whose only text is a full "enable JavaScript" sentence is still a shell.
  test('a script page whose only text asks for JavaScript needs a render', () => {
    const page =
      '<html><head><script src=/app.js></script></head><body><div id="root"></div>' +
      '<p>You need to enable JavaScript in your browser to run this app.</p></body></html>'
    expect(needsJs(page)).toBe(true)
  })

  test('render off keeps the fetched page and starts no browser', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const html = yield* fixture('spa-shell.html')
        const page = yield* withFallbacks('https://x.test/', Effect.succeed({ html }), 'off')
        expect(page).toEqual({ html })
      }),
    ))
})

const pdfServer = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      maxRequestBodySize: 1024,
      fetch: () =>
        new Response(Bun.file(`${dir}/attention.pdf`), {
          headers: { 'content-type': 'application/pdf' },
        }),
    }),
  ),
  (server) => Effect.promise(() => server.stop(true)),
)

describe('PDF route', () => {
  test('a refused PDF reads through the parse reader', () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const server = yield* pdfServer
          const url = `http://localhost:${server.port}/paper.pdf`
          const refused = Effect.fail(
            new Error(`fetch ${url}: unsupported content-type "application/pdf"`),
          )
          const page = yield* withFallbacks(url, refused, 'agent-browser')
          expect('markdown' in page ? page.markdown : '').toContain('scaled dot-product attention')
        }),
      ),
    ))
})
