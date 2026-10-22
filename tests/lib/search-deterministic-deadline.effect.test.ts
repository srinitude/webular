// Deterministic mode (WEBULAR_DETERMINISTIC=1): the whole-search deadline must not
// cut a source that answers inside its own SOURCE_TIMEOUT_MS cap, so a slow
// source never changes the hits.
import { describe, expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { eff } from '../_support/run.ts'

const slow: SourceRunner = () =>
  Effect.as(Effect.sleep(300), [{ title: 'Bun', url: 'https://bun.com', description: '' }])

const withEnv = (det: string) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown({ WEBULAR_DETERMINISTIC: det }),
  )

const run = (det: string) =>
  searchEffect('wikipedia', 'bun runtime', 5, { runSource: slow, deadlineMs: 100 }).pipe(
    withEnv(det),
  )

describe('searchEffect — deterministic deadline', () => {
  test(
    'a slow source inside its own cap keeps its hits',
    eff(
      Effect.gen(function* () {
        const { results } = yield* run('1')
        expect(results.map((h) => h.url)).toEqual(['https://bun.com'])
      }),
    ),
  )
  test(
    'outside deterministic mode the deadline still cuts',
    eff(
      Effect.gen(function* () {
        const { results } = yield* run('')
        expect(results).toEqual([])
      }),
    ),
  )
})
