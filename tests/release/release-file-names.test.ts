// docs/install-more.md's "Release file names" list names every file the
// release workflow attaches, and only those. Each `dist/bin/<name>` upload in
// .github/workflows/release.yml must be listed, and each listed name must be
// uploaded (`webular-<build>` names stand for the `webular-*` glob).
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const read = (p: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(join(ROOT, p)))

const uploaded = (workflow: string) =>
  new Set(
    workflow
      .split('\n')
      .filter((l) => /gh release upload|^\s*set -- /.test(l))
      .flatMap((l) => [...l.matchAll(/dist\/bin\/([\w.*-]+)/g)].map((m) => m[1] ?? '')),
  )

const listed = (doc: string) => {
  const section = doc.split('### Release file names')[1]?.split('\n## ')[0] ?? ''
  return new Set(
    [...section.matchAll(/^- (.+?):/gm)].flatMap((m) =>
      [...(m[1] ?? '').matchAll(/`([^`]+)`/g)].map((x) => x[1] ?? ''),
    ),
  )
}

describe('release file names in the docs match the release workflow', () => {
  test(
    'every uploaded file is listed, and every listed file is uploaded',
    eff(
      Effect.gen(function* () {
        const up = uploaded(yield* read('.github/workflows/release.yml'))
        const docs = listed(yield* read('docs/install-more.md'))
        const unlisted = [...up].filter((n) => n !== 'webular-*' && !docs.has(n))
        const notUploaded = [...docs].filter((n) => !up.has(n) && !n.startsWith('webular-'))
        expect(up.has('webular-*')).toBe(true)
        expect(docs.has('webular-<build>')).toBe(true)
        expect({ unlisted, notUploaded }).toEqual({ unlisted: [], notUploaded: [] })
      }),
    ),
  )
})
