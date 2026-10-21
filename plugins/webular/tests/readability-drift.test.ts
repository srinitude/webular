// Drift guard: webular's built-in human-language and rich-and-native-markdown
// skills are tuned copies of the readability sources. Each source's rule lines
// (list items and numbered steps) are normalized and hashed; when a source rule
// changes, this fails until the webular copy is reviewed and the hash updated.
import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Option } from 'effect'

const sources = `${homedir()}/.claude/mods/readability/skills`
const pinned: Record<string, string> = {
  'human-language': '605c5e4b8f7f55050c49b40be22519b57779b0fb6621fcb6d337cb535e220955',
  'rich-and-native-markdown': 'db22767244c94797e03834d6448051a53c42b599e808975d71b442f203fd81d5',
}

// Rule lines only, with Markdown marks, case, and spacing removed.
export const ruleHash = (text: string) =>
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

const readSource = (name: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.readFileString(`${sources}/${name}/SKILL.md`)),
    Effect.option,
    Effect.provide(BunServices.layer),
  )

for (const [name, hash] of Object.entries(pinned))
  test(`${name} source rules match the pinned hash`, () =>
    Effect.runPromise(
      readSource(name).pipe(
        Effect.map(
          Option.match({
            onNone: () => console.warn(`skip: no readability source for ${name} on this machine`),
            onSome: (text) => expect(`${name}: ${ruleHash(text)}`).toBe(`${name}: ${hash}`),
          }),
        ),
      ),
    ))

test('ruleHash ignores formatting but not wording', () => {
  expect(ruleHash('- Keep **exact** names\ntext')).toBe(ruleHash('*   keep exact   `names`'))
  expect(ruleHash('- Keep exact names')).not.toBe(ruleHash('- Keep some names'))
})
