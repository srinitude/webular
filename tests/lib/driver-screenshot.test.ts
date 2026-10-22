// The optional render screenshot: off by default, on with WEBULAR_SCREENSHOT=1.
// A stub `agent-browser` (compiled Bun, so it runs on Windows too) answers the
// batch: `open` + `get html` print markup, `screenshot` writes a file by the
// case's mode. A child process with the stub first on PATH renders one page.
// The screenshot's temp dir is made under TMPDIR, pointed at the worktree here.
import { expect, test } from 'bun:test'
import { platform } from 'node:os'
import { delimiter } from 'node:path'
import { Config, Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { MAX_CAPTURE_BYTES } from '../../src/lib/driver-screenshot.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

// Prints the html, then the screenshot as base64 (or "none").
const CHILD = `import { Effect } from 'effect'
import { AgentBrowserLive, Driver } from './src/lib/driver.ts'
const r = await Effect.runPromise(Effect.provide(
  Driver.use((d) => d.render('https://x.test/')),
  AgentBrowserLive,
))
console.log(r.html)
console.log(r.screenshot ? Buffer.from(r.screenshot).toString('base64') : 'none')`

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
const HTML = '<html><body>hello page</body></html>'

// mode: ok = write JPEG, big = write a file over the cap, fail = exit 1, no file.
// Each call appends its first command (words joined by spaces) to `calls`.
const stubSource = (dir: string) => `const dir = ${JSON.stringify(dir)}
const commands: string[][] = await Bun.stdin.json()
const mode = (await Bun.file(dir + '/mode').text()).trim()
const calls = await Bun.file(dir + '/calls').text().catch(() => '')
await Bun.write(dir + '/calls', calls + commands[0]?.join(' ') + '\\n')
if (commands[0]?.[0] !== 'screenshot') { console.log(${JSON.stringify(HTML)}); process.exit(0) }
if (mode === 'fail') { process.stderr.write('screenshot failed'); process.exit(1) }
const file = commands[0].at(-1) as string
await Bun.write(file, mode === 'big' ? new Uint8Array(${MAX_CAPTURE_BYTES} + 1) : new Uint8Array([255, 216, 255, 217]))`

const buildStub = (stubs: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString(`${stubs}/stub.ts`, stubSource(stubs))
    const build = yield* runProc(
      ['bun', 'build', '--compile', `${stubs}/stub.ts`, '--outfile', `${stubs}/agent-browser`],
      { timeoutMs: 60_000, cwd: ROOT },
    )
    expect([build.code, build.stderr]).toEqual([0, ''])
  })

// Renders one page; returns [html, screenshot base64 or "none", stub calls].
const render = (stubs: string, tmp: string, mode: string, on: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString(`${stubs}/mode`, mode)
    yield* fs.remove(`${stubs}/calls`, { force: true })
    const PATH = yield* Config.String('PATH')
    const env: Record<string, string> = { PATH: `${stubs}${delimiter}${PATH}`, TMPDIR: tmp }
    if (on) env['WEBULAR_SCREENSHOT'] = '1'
    const res = yield* runProc(['bun', '-e', CHILD], {
      timeoutMs: 60_000,
      cwd: ROOT,
      env,
      extendEnv: true,
    })
    const [html, shot] = res.stdout.trim().split('\n')
    const calls = (yield* fs.readFileString(`${stubs}/calls`)).trim().split('\n')
    return { html, shot, calls }
  })

test.skipIf(platform() === 'win32')(
  'a render takes a screenshot only when asked, and drops one that fails or is too big',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const stubs = yield* tmpDir('webular-shot-stub-')
      const tmp = yield* fs.makeTempDirectoryScoped({ directory: ROOT, prefix: '.shot-test-' })
      yield* buildStub(stubs)

      const off = yield* render(stubs, tmp, 'ok', false)
      expect([off.html, off.shot]).toEqual([HTML, 'none'])
      expect(off.calls.some((c) => c.startsWith('screenshot'))).toBe(false)

      const on = yield* render(stubs, tmp, 'ok', true)
      expect(on.html).toBe(HTML)
      expect(Buffer.from(on.shot as string, 'base64')).toEqual(JPEG)
      const shotCall = on.calls.at(-1) as string
      expect(shotCall.startsWith('screenshot --full --screenshot-format jpeg ')).toBe(true)
      expect(shotCall.endsWith('page.jpg')).toBe(true)
      expect(shotCall.includes(tmp)).toBe(true)

      for (const mode of ['fail', 'big']) {
        const dropped = yield* render(stubs, tmp, mode, true)
        expect([mode, dropped.html, dropped.shot]).toEqual([mode, HTML, 'none'])
      }
      expect(yield* fs.readDirectory(tmp)).toEqual([])
    }),
  ),
  240_000,
)
