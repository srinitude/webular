// The keyless web index joins general and software searches: Marginalia (with
// its shared "public" key, and its data license kept as attribution) and
// GitHub repository search.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { pickSources } from '../../src/lib/search-intent.ts'
import { marginalia } from '../../src/lib/sources/web.ts'
import { against, body, json, run } from './sources/support.ts'

const keyed = () =>
  Effect.gen(function* () {
    const text = yield* body('marginalia-search.json')
    const seen = { key: '', query: '' }
    const route = (req: Request, url: URL) => {
      seen.key = req.headers.get('api-key') ?? ''
      seen.query = url.searchParams.get('query') ?? ''
      return json(text)
    }
    const hits = yield* against({ '/search': route }, marginalia('effect typescript', 2))
    return { hits, seen }
  })

describe('keyless web index', () => {
  // Marginalia's shared public key answers 429 or times out, holding every
  // fan-out to the settle cutoff for no hits; it runs only when named.
  test('general and software searches ask GitHub, not Marginalia', () => {
    for (const q of ['uv astral python package manager', 'some general query']) {
      expect(pickSources(q)).not.toContain('marginalia')
      expect(pickSources(q)).toContain('github-search')
    }
  })

  test(
    'Marginalia uses the public key and credits its license',
    () =>
      run(
        Effect.map(keyed(), ({ hits, seen }) => {
          expect(seen.key).toBe('public')
          expect(seen.query).toBe('effect typescript')
          expect(hits[0]?.description).toContain('CC-BY-NC-SA 4.0')
        }),
      ),
    15_000,
  )
})
