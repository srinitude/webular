// Contract for the free local baselines: command args, mapping to Output, the
// skip path for a missing tool, and BenchError for a failing process. A fake
// spawner and HTTP client replay recorded output, so nothing here is installed.
import { expect, test } from 'bun:test'
import { Effect, Stream } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { ChildProcessSpawner } from 'effect/process'
import { baselines } from '../../scripts/bench/peers/baselines.ts'
import type { Provider } from '../../scripts/bench/peers/model.ts'

interface Reply {
  code: number
  stdout: string
}
type Script = (argv: string[], stdin: string) => Reply
type Std = { command: string; args: string[]; options: { stdin?: unknown } }

const bytesOf = (s: string) => Stream.make(new TextEncoder().encode(s))
const noBytes = Stream.empty

// A finished process handle that exits with the reply's code and stdout.
const handle = (r: Reply) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(r.code)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stdin: undefined as never,
    stdout: bytesOf(r.stdout),
    stderr: noBytes,
    all: bytesOf(r.stdout),
    getInputFd: () => undefined as never,
    getOutputFd: () => noBytes,
    unref: Effect.succeed(Effect.void),
  })

// A spawner that replies per argv and records every call with its stdin.
const fakeSpawner = (script: Script) => {
  const calls: { argv: string[]; stdin: string }[] = []
  const spawner = ChildProcessSpawner.make((cmd) =>
    Effect.gen(function* () {
      const std = cmd as unknown as Std
      const input = std.options.stdin
      const stdin =
        typeof input === 'object' && input !== null
          ? yield* Stream.mkString(Stream.decodeText(input as Stream.Stream<Uint8Array>))
          : ''
      const argv = [std.command, ...std.args]
      calls.push({ argv, stdin })
      return handle(script(argv, stdin))
    }),
  )
  return { spawner, calls }
}

// An HTTP client that answers every request with one body, or a 503 when null.
const fakeHttp = (body: string | null) => {
  const urls: string[] = []
  const client = HttpClient.make((req, url) => {
    urls.push(url.toString())
    const res = body === null ? new Response('down', { status: 503 }) : new Response(body)
    return Effect.succeed(HttpClientResponse.fromWeb(req, res))
  })
  return { client, urls }
}

const build = (script: Script, body: string | null) => {
  const sp = fakeSpawner(script)
  const http = fakeHttp(body)
  const providers = baselines.pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, sp.spawner),
    Effect.provideService(HttpClient.HttpClient, http.client),
  )
  return { providers, ...sp, urls: http.urls }
}

const find = (all: readonly Provider[], id: string) => all.find((x) => x.id === id) as Provider
const scrape = (p: Provider, url: string) =>
  (p.jobs.scrape as NonNullable<Provider['jobs']['scrape']>)({ url })

const searxJson = JSON.stringify({
  results: [{ url: 'https://a.test', title: 'A', content: 'about a' }, { url: 'https://b.test' }],
})
const allInstalled: Script = (argv, stdin) => {
  if (argv[0] === 'curl' && argv[1] === '-sL') return { code: 0, stdout: '<h1>Hi</h1>' }
  if (argv[0] === 'html2text' && stdin) return { code: 0, stdout: '# Hi' }
  if (argv[0] === 'trafilatura' && argv[1] === '-u') return { code: 0, stdout: 'trafilatura md' }
  if (argv[0] === 'crwl' && argv[1] !== '--help') return { code: 0, stdout: 'crawl md' }
  return { code: 0, stdout: '' }
}

test('builds six local baselines with no key or skip when all tools exist', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const all = yield* build(allInstalled, searxJson).providers
      expect(all.map((p) => p.id)).toEqual([
        'searxng',
        'trafilatura',
        'curl-html2text',
        'crawl4ai',
        'scrapegraph',
        'readability',
      ])
      for (const p of all)
        expect([p.local, p.keyNames.length, p.skip]).toEqual([true, 0, undefined])
    }),
  ))

test('scrape baselines run the CLI with the documented args and map stdout to Output', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { providers, calls } = build(allInstalled, searxJson)
      const all = yield* providers
      const url = 'https://x.test/p'
      const tra = yield* scrape(find(all, 'trafilatura'), url)
      const crawl = yield* scrape(find(all, 'crawl4ai'), url)
      const curl = yield* scrape(find(all, 'curl-html2text'), url)
      const argvs = calls.map((c) => c.argv.join(' '))
      expect(argvs).toContain(`trafilatura -u ${url} --markdown`)
      expect(argvs).toContain(`crwl ${url} -o markdown`)
      expect(argvs).toContain(`curl -sL ${url}`)
      expect(calls.find((c) => c.argv[0] === 'html2text' && c.stdin)?.stdin).toBe('<h1>Hi</h1>')
      expect(tra).toEqual({
        text: 'trafilatura md',
        urls: [url],
        citations: [],
        costUsd: 0,
        sentBytes: 0,
      })
      expect([crawl.text, curl.text]).toEqual(['crawl md', '# Hi'])
    }),
  ))

test('searxng asks GET /search?format=json at SEARXNG_URL and maps hits', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { providers, urls } = build(allInstalled, searxJson)
      const search = find(yield* providers, 'searxng').jobs.search as NonNullable<
        Provider['jobs']['search']
      >
      const o = yield* search({ query: 'cats' })
      const last = new URL(urls[urls.length - 1] ?? '')
      expect([last.origin, last.pathname]).toEqual(['http://localhost:8888', '/search'])
      expect([last.searchParams.get('q'), last.searchParams.get('format')]).toEqual([
        'cats',
        'json',
      ])
      expect(o.urls).toEqual(['https://a.test', 'https://b.test'])
      expect(o.text).toContain('A\nhttps://a.test\nabout a')
      expect([o.costUsd, o.sentBytes]).toEqual([0, 4])
    }),
  ))

test('readability fetches the page over HTTP and returns the article text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const html = '<html><body><article><p>Hello readable world.</p></article></body></html>'
      const { providers } = build(allInstalled, html)
      const o = yield* scrape(find(yield* providers, 'readability'), 'https://x.test/a')
      expect(o.text).toContain('Hello readable world.')
      expect([o.urls, o.costUsd]).toEqual([['https://x.test/a'], 0])
    }),
  ))

test('a missing tool or an unreachable SearXNG is skipped with a note and no jobs', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const missing = ['html2text', 'crwl', 'trafilatura']
      const script: Script = (argv) =>
        missing.includes(argv[0] ?? '') || argv[0] === 'python3'
          ? { code: 127, stdout: '' }
          : { code: 0, stdout: '' }
      const all = yield* build(script, null).providers
      const skips = Object.fromEntries(all.map((p) => [p.id, p.skip]))
      expect(skips).toEqual({
        searxng: 'SearXNG not reachable at http://localhost:8888',
        trafilatura: 'not installed: trafilatura',
        'curl-html2text': 'not installed: html2text',
        crawl4ai: 'not installed: crawl4ai',
        scrapegraph: 'not installed: scrapegraphai',
        readability: undefined,
      })
      expect(Object.keys(find(all, 'trafilatura').jobs)).toEqual([])
    }),
  ))

test('a failing process yields a BenchError carrying the exit code', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const failing: Script = (argv) =>
        argv[0] === 'trafilatura' && argv[1] === '-u'
          ? { code: 2, stdout: '' }
          : { code: 0, stdout: '' }
      const all = yield* build(failing, searxJson).providers
      const err = yield* Effect.flip(scrape(find(all, 'trafilatura'), 'https://x.test'))
      expect(err._tag).toBe('BenchError')
      expect(err.message).toContain('trafilatura exited 2')
    }),
  ))
