// Drift guard: webular's built-in human-language and rich-and-native-markdown
// skills are tuned copies of the readability sources. Each source's rule lines
// (list items and numbered steps) are normalized and hashed; when a source rule
// changes, this fails until the webular copy is reviewed and the hash updated.
// The copy side is pinned too, so a copy edit also needs a reviewed hash, and
// the copies must be real files that ship inside the plugin, never symlinks.
// WEBULAR_READABILITY_SOURCES names the readability skills folder; the source
// side skips when it is unset, and logs a skip when that folder is missing.
import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Option } from 'effect'

const sources = process.env.WEBULAR_READABILITY_SOURCES
const copies = fileURLToPath(new URL('../skills', import.meta.url))
const pinned: Record<string, string> = {
  'human-language': '605c5e4b8f7f55050c49b40be22519b57779b0fb6621fcb6d337cb535e220955',
  'rich-and-native-markdown': 'db22767244c94797e03834d6448051a53c42b599e808975d71b442f203fd81d5',
}
const pinnedCopies: Record<string, string> = {
  'human-language': 'd6d980355aa50f8d7add5dd3cef6f00b79896d026f63eb9b19a670c081739437',
  'rich-and-native-markdown': '4cbfa3089f7d1b15b6d351c9967058fe2a5af3f8faf43a661cab3004bb82a206',
}

// Rule lines only, with Markdown marks, case, and spacing removed.
const ruleHash = (text: string) =>
  createHash('sha256')
    .update(
      text
        .split('\n')
        .filter((line) => /^\s*(?:[-*]|\d+\.)\s+\S/.test(line))
        .map((line) =>
          line
            .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
            .replace(/[*_`[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase(),
        )
        .join('\n'),
    )
    .digest('hex')

const withFs = <A, E>(use: (fs: FileSystem.FileSystem) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    FileSystem.FileSystem.pipe(Effect.flatMap(use), Effect.provide(BunServices.layer)),
  )

const checkSource = (fs: FileSystem.FileSystem, name: string, hash: string) =>
  fs.readFileString(`${sources}/${name}/SKILL.md`).pipe(
    Effect.option,
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.logWarning(`skip: no readability source for ${name} in ${sources}`),
        onSome: (text) =>
          Effect.sync(() => expect(`${name}: ${ruleHash(text)}`).toBe(`${name}: ${hash}`)),
      }),
    ),
  )

// "file" when readLink fails (not a link), "link" when it resolves.
const kind = (fs: FileSystem.FileSystem, path: string) =>
  fs.readLink(path).pipe(Effect.match({ onFailure: () => 'file', onSuccess: () => 'link' }))

for (const [name, hash] of Object.entries(pinned))
  test.skipIf(!sources)(`${name} source rules match the pinned hash`, () =>
    withFs((fs) => checkSource(fs, name, hash)))

for (const [name, hash] of Object.entries(pinnedCopies))
  test(`${name} copy rules match the reviewed hash`, () =>
    withFs((fs) =>
      fs
        .readFileString(`${copies}/${name}/SKILL.md`)
        .pipe(Effect.map((text) => expect(`${name}: ${ruleHash(text)}`).toBe(`${name}: ${hash}`))),
    ))

test('the built-in readability skills are real files, never symlinks', () =>
  withFs((fs) =>
    Effect.forEach(
      Object.keys(pinnedCopies).flatMap((name) => [`${name}`, `${name}/SKILL.md`]),
      (path) => Effect.map(kind(fs, `${copies}/${path}`), (found) => `${path}: ${found}`),
      { concurrency: 4 },
    ).pipe(
      Effect.map((found) =>
        expect(found).toEqual(found.map((line) => line.replace(/link$/, 'file'))),
      ),
    ),
  ))

test('ruleHash ignores formatting but not wording', () => {
  expect(ruleHash('- Keep **exact** names\ntext')).toBe(ruleHash('*   keep exact   `names`'))
  expect(ruleHash('- Keep exact names')).not.toBe(ruleHash('- Keep some names'))
})
