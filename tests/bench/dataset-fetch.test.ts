// The dataset fetch: committed manifests parse, a wrong hash fails and writes nothing,
// and a cached file with the right hash makes no network call. A stub HttpClient
// serves a local fixture; no test touches the network.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'
import { fetchSet } from '../../scripts/bench/dataset-fetch.ts'
import {
  type DatasetManifest,
  decodeManifest,
  loadRows,
  parseCsv,
  records,
  sample,
  sha256,
} from '../../scripts/bench/dataset-manifest.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

const FIXTURE = `${JSON.stringify({ track_id: 'a', url: 'https://x.test/a', html: '<p>a</p>' })}\n${JSON.stringify({ track_id: 'b', url: 'https://x.test/b', html: '<p>b</p>' })}\n`

const manifestFor = (text: string): Effect.Effect<DatasetManifest, unknown> =>
  Effect.gen(function* () {
    const rows = yield* records('jsonl', 'track_id', text)
    return {
      set: 'fixture',
      repo: 'example/fixture',
      revision: 'r1',
      file: 'rows.jsonl',
      format: 'jsonl',
      idField: 'track_id',
      bytes: new TextEncoder().encode(text).byteLength,
      sha256: sha256(text),
      license: 'test',
      subset: 'all',
      rows: rows.map(({ id, url, sha256: hash }) => ({ id, url, sha256: hash })),
    } as const
  })

// A client that answers every request with `body` and counts the calls.
const stub = (body: string) => {
  const seen: string[] = []
  const client = HttpClient.make((req) =>
    Effect.sync(() => {
      seen.push(req.url)
      return HttpClientResponse.fromWeb(req, new Response(body))
    }),
  )
  return { seen, client }
}

test(
  'the committed manifests parse and pin a revision, a hash, and per-row hashes',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = `${import.meta.dir}/../../bench/datasets`
      const names = (yield* fs.readDirectory(dir)).filter((n) => n.endsWith('.json'))
      expect(names.sort()).toEqual(['firecrawl-scrape.json', 'webmainbench.json'])
      for (const name of names) {
        const m = yield* decodeManifest(name, yield* fs.readFileString(`${dir}/${name}`))
        expect(m.revision).toMatch(/^[0-9a-f]{40}$/)
        expect(m.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(m.rows.length).toBeGreaterThan(0)
        expect(
          m.rows.every((r) => /^[0-9a-f]{64}$/.test(r.sha256) && r.url.startsWith('http')),
        ).toBe(true)
        expect(new Set(m.rows.map((r) => r.id)).size).toBe(m.rows.length)
      }
      expect(yield* failMsg(decodeManifest('bad.json', '{"set":"x"}'))).toContain('bad.json')
    }),
  ),
)

test(
  'a download whose sha256 differs fails and writes nothing',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('dataset-')
      const fs = yield* FileSystem.FileSystem
      const m = yield* manifestFor(FIXTURE)
      const { seen, client } = stub(FIXTURE.replace('a', 'z'))
      const msg = yield* failMsg(
        fetchSet(m, dir).pipe(Effect.provideService(HttpClient.HttpClient, client)),
      )
      expect(msg).toContain('sha256 differs')
      expect(seen).toEqual([
        'https://huggingface.co/datasets/example/fixture/resolve/r1/rows.jsonl',
      ])
      expect(yield* fs.exists(`${dir}/fixture/rows.jsonl`)).toBe(false)
      expect(yield* fs.exists(`${dir}/fixture/rows.jsonl.part`)).toBe(false)
    }),
  ),
)

test(
  'a cached file with the right hash makes no network call',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('dataset-')
      const m = yield* manifestFor(FIXTURE)
      const { seen, client } = stub(FIXTURE)
      const run = fetchSet(m, dir).pipe(Effect.provideService(HttpClient.HttpClient, client))
      expect(yield* run).toBe('fetched')
      expect(seen.length).toBe(1)
      expect(yield* run).toBe('cached')
      expect(seen.length).toBe(1)
    }),
  ),
)

test(
  'rows load only when every row hash matches the manifest',
  eff(
    Effect.gen(function* () {
      const m = yield* manifestFor(FIXTURE)
      expect((yield* loadRows(m, FIXTURE)).map((r) => r.id)).toEqual(['a', 'b'])
      const msg = yield* failMsg(loadRows(m, FIXTURE.replace('<p>b</p>', '<p>c</p>')))
      expect(msg).toContain('row hash differs')
    }),
  ),
)

test('the CSV parser keeps quoted commas, newlines, and doubled quotes', () => {
  expect(parseCsv('id,t\r\n1,"a,""b""\nc"\n2,d')).toEqual([
    ['id', 't'],
    ['1', 'a,"b"\nc'],
    ['2', 'd'],
  ])
})

test(
  'the sample rule is independent of file order',
  eff(
    Effect.gen(function* () {
      const fwd = yield* records('jsonl', 'track_id', FIXTURE)
      const rev = yield* records(
        'jsonl',
        'track_id',
        FIXTURE.trimEnd().split('\n').reverse().join('\n'),
      )
      expect(sample(fwd, 1).map((r) => r.id)).toEqual(sample(rev, 1).map((r) => r.id))
    }),
  ),
)
