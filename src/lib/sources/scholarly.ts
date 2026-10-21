// Keyless scholarly search: Europe PMC REST, which also indexes all of PubMed.
// Crossref and OpenAlex live in search-chain.ts. Semantic Scholar is left out:
// its keyless pool answered 429 on the first probe.
import { Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

const EuropePmc = Schema.fromJsonString(
  Schema.Struct({
    resultList: Schema.Struct({
      result: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          source: Schema.String,
          title: Schema.optional(Schema.String),
          doi: Schema.optional(Schema.String),
          abstractText: Schema.optional(Schema.String),
          journalTitle: Schema.optional(Schema.String),
          pubYear: Schema.optional(Schema.String),
        }),
      ),
    }),
  }),
)

const describe = (r: {
  abstractText?: string | undefined
  journalTitle?: string | undefined
  pubYear?: string | undefined
}) =>
  r.abstractText
    ? r.abstractText.replace(/<[^>]+>/g, '')
    : [r.journalTitle, r.pubYear].filter(Boolean).join(', ')

export const europePmc = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(EuropePmc, 'https://www.ebi.ac.uk/europepmc/webservices/rest/search', {
    query,
    format: 'json',
    resultType: 'core',
    pageSize: String(limit),
  }).pipe(
    Effect.map(({ resultList }) =>
      resultList.result.map((r) => ({
        title: r.title ?? '',
        url: r.doi
          ? `https://doi.org/${r.doi}`
          : `https://europepmc.org/article/${r.source}/${r.id}`,
        description: describe(r),
      })),
    ),
  )

const ESearch = Schema.fromJsonString(
  Schema.Struct({ esearchresult: Schema.Struct({ idlist: Schema.Array(Schema.String) }) }),
)

const Summary = Schema.Struct({
  title: Schema.String,
  source: Schema.optional(Schema.String),
  pubdate: Schema.optional(Schema.String),
  articleids: Schema.Array(Schema.Struct({ idtype: Schema.String, value: Schema.String })),
})

// esummary's `result` mixes a `uids` list with one summary per id.
const ESummary = Schema.fromJsonString(
  Schema.Struct({
    result: Schema.Record(Schema.String, Schema.Union([Schema.Array(Schema.String), Summary])),
  }),
)

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

const pubmedHit = (id: string, s: typeof Summary.Type): Hit => {
  const doi = s.articleids.find((a) => a.idtype === 'doi')?.value
  return {
    title: s.title,
    url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    description: [s.source, s.pubdate].filter(Boolean).join(', '),
  }
}

// NCBI E-utilities over PubMed: esearch for ids, then esummary for titles, two
// polite requests to one host (keyless pool: 3 a second).
export const ncbiEutils = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  Effect.gen(function* () {
    const found = yield* getJson(ESearch, `${EUTILS}/esearch.fcgi`, {
      db: 'pubmed',
      term: query,
      retmode: 'json',
      retmax: String(limit),
    })
    const ids = found.esearchresult.idlist
    if (ids.length === 0) return []
    const { result } = yield* getJson(ESummary, `${EUTILS}/esummary.fcgi`, {
      db: 'pubmed',
      id: ids.join(','),
      retmode: 'json',
    })
    return ids.flatMap((id) => {
      const s = result[id]
      return s && !Array.isArray(s) ? [pubmedHit(id, s as typeof Summary.Type)] : []
    })
  })
