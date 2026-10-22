// Repository settings as code: the shape of .github/repo-settings.json, and the
// workflow that checks it read-only. The values are not pinned here.
import { describe, expect, test } from 'bun:test'

import { Effect, Schema } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const Settings = Schema.fromJsonString(
  Schema.Struct({
    description: Schema.String,
    homepage: Schema.String,
    topics: Schema.Array(Schema.String),
  }),
)
const decode = Schema.decodeUnknownEffect(Settings)

const read = (path: string) => io(() => Bun.file(`${ROOT}${path}`).text())

describe('repo settings file', () => {
  test(
    'has a description, a homepage, and topics, and nothing else',
    eff(
      Effect.gen(function* () {
        const s = yield* decode(yield* read('.github/repo-settings.json'), {
          onExcessProperty: 'error',
        })
        expect(s.description.length).toBeLessThanOrEqual(350)
        expect(s.homepage === '' || /^https:\/\/\S+$/.test(s.homepage)).toBe(true)
        expect(s.topics.length).toBeLessThanOrEqual(20)
        expect(new Set(s.topics).size).toBe(s.topics.length)
        for (const t of s.topics) expect(t).toMatch(/^[a-z0-9][a-z0-9-]{0,49}$/)
      }),
    ),
  )

  test(
    'the workflow is read-only and runs repo:settings:check',
    eff(
      Effect.gen(function* () {
        const yml = yield* read('.github/workflows/repo-settings.yml')
        expect(yml).toMatch(/^permissions:\n {2}contents: read\n/m)
        expect(yml).not.toMatch(/: write/)
        expect(yml).toContain('mise run repo:settings:check')
        expect(yml).not.toMatch(/mise run repo:settings$/m)
      }),
    ),
  )
})
