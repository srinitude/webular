// A fetched public dataset is pinned by a manifest in git: the Hugging Face
// revision, the file's sha256 and size, and the chosen rows (id, url, row hash).
// The page content itself is never committed; the cache holds it (see
// bench/datasets/AGENTS.md). This module holds the manifest shape, the hashes,
// the row parsers, and the row check that dataset-fetch.ts and the pin script share.
import { Data, Effect, Schema } from 'effect'

export class DatasetError extends Data.TaggedError('DatasetError')<{ message: string }> {}

const Row = Schema.Struct({ id: Schema.String, url: Schema.String, sha256: Schema.String })

export const DatasetManifest = Schema.Struct({
  set: Schema.String,
  repo: Schema.String,
  revision: Schema.String,
  file: Schema.String,
  format: Schema.Literals(['jsonl', 'csv']),
  idField: Schema.String,
  bytes: Schema.Number,
  sha256: Schema.String,
  license: Schema.String,
  subset: Schema.String,
  rows: Schema.Array(Row),
})
export type DatasetManifest = typeof DatasetManifest.Type

export const sha256 = (data: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(data).digest('hex')

export const refuse = (message: string) => Effect.fail(new DatasetError({ message }))

export const decodeManifest = (name: string, text: string) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(DatasetManifest))(text).pipe(
    Effect.mapError((e) => new DatasetError({ message: `${name}: ${String(e)}` })),
  )

// RFC 4180: quoted fields hold commas, newlines, and doubled quotes.
export const parseCsv = (text: string): string[][] => {
  // One sticky match per cell: a quoted or plain field, then its separator. It always matches.
  const cell = /("(?:[^"]|"")*"|[^,\r\n]*)(,|\r\n|\n|\r|$)/y
  const rows: string[][] = []
  let row: string[] = []
  while (cell.lastIndex < text.length || row.length > 0) {
    const [, raw = '', sep = ''] = cell.exec(text) ?? []
    row.push(raw.startsWith('"') ? raw.slice(1, -1).replaceAll('""', '"') : raw)
    if (sep === ',') continue
    rows.push(row)
    row = []
  }
  return rows
}

export interface DatasetRecord {
  readonly id: string
  readonly url: string
  readonly sha256: string
  readonly row: Readonly<Record<string, unknown>>
}

// Row hash: sha256 of the raw JSONL line, or of the CSV row as JSON in header order.
export const records = (
  format: DatasetManifest['format'],
  idField: string,
  text: string,
): Effect.Effect<ReadonlyArray<DatasetRecord>, DatasetError> =>
  Effect.try({
    try: () => {
      const make = (row: Record<string, unknown>, raw: string): DatasetRecord => ({
        id: String(row[idField]),
        url: String(row['url']),
        sha256: sha256(raw),
        row,
      })
      if (format === 'jsonl')
        return text
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line) => make(JSON.parse(line), line))
      const [head = [], ...body] = parseCsv(text)
      return body
        .filter((cells) => cells.length === head.length)
        .map((cells) => {
          const row = Object.fromEntries(head.map((h, i) => [h, cells[i]]))
          return make(row, JSON.stringify(row))
        })
    },
    catch: (e) => new DatasetError({ message: `unreadable ${format} file: ${String(e)}` }),
  })

// The manifest's rows, read from the cached file; refuses a missing id or a row whose hash differs.
export const loadRows = (m: DatasetManifest, text: string) =>
  Effect.gen(function* () {
    const byId = new Map((yield* records(m.format, m.idField, text)).map((r) => [r.id, r]))
    const bad = m.rows.filter((r) => byId.get(r.id)?.sha256 !== r.sha256).map((r) => r.id)
    if (bad.length > 0) return yield* refuse(`${m.set}: row hash differs or row missing: ${bad}`)
    return m.rows.map((r) => byId.get(r.id) as DatasetRecord)
  })

// The sample rule: rank rows by sha256 of the id, keep the first n. Deterministic and
// independent of file order, so a refetch or a re-pin picks the same rows.
export const sample = (all: ReadonlyArray<DatasetRecord>, n: number) =>
  all
    .map((r) => ({ r, key: sha256(r.id) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, n)
    .map(({ r }) => r)
