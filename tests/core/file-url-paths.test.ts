// Guard: a module URL becomes a file path only through fileURLToPath. A URL's
// pathname on Windows is "/D:/a/..." (a leading slash, no drive root), so a
// path built from it is missing there: the plugin bundle and startup tests
// failed on windows-latest for exactly this reason.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { ROOT } from '../_support/root.ts'

const DIRS = ['src', 'tests', 'scripts', 'plugins/webular/src', 'plugins/webular/tests']
// A module URL read as a pathname, or a URL pathname handed to a file call.
const URL_PATHNAME =
  /import\.meta\.url\)\.pathname|\b(?:readDirectory|readFileString|readFile|exists|access|stat|remove)\(.*\.pathname\b/

const offenders = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = yield* Effect.forEach(
    DIRS,
    (dir) =>
      fs
        .readDirectory(`${ROOT}${dir}`, { recursive: true })
        .pipe(Effect.map((all) => all.filter((f) => /\.tsx?$/.test(f)).map((f) => `${dir}/${f}`))),
    { concurrency: 5 },
  )
  const flat = files.flat()
  const texts = yield* Effect.forEach(flat, (f) => fs.readFileString(`${ROOT}${f}`), {
    concurrency: 16,
  })
  return flat.filter((_, i) => URL_PATHNAME.test(texts[i] ?? ''))
}).pipe(Effect.provide(BunServices.layer))

test('no file turns a module URL into a path through its pathname', () =>
  Effect.runPromise(offenders.pipe(Effect.map((bad) => expect(bad).toEqual([])))))

test('fileURLToPath decodes a Windows drive URL to a drive path', () => {
  expect(fileURLToPath('file:///D:/a/webular/dist/server.js', { windows: true })).toBe(
    'D:\\a\\webular\\dist\\server.js',
  )
  expect(new URL('file:///D:/a/webular/dist/server.js').pathname).toBe(
    '/D:/a/webular/dist/server.js',
  )
})
