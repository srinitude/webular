# Built task sources

## Why this file exists

Some benchmark tasks are built here instead of copied from a public set.
This file names the source and license behind each built task, and the limits a reader should know.
The licenses of the public sets are in [LICENSES.md](LICENSES.md).

## Hand-curated answer sources

These pages back the tasks in `scripts/bench/tasks/answer-seed.json`.
Each page was fetched with Firecrawl on 2026-10-21, and each gold answer is quoted from the fetched text.

- **Wikipedia**
  - Data license: CC-BY-SA-4.0, read at <https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License>.
  - No-answer pages, where the text says the fact is unknown:
    - <https://en.wikipedia.org/wiki/Diviciacus_(Aedui)>
    - <https://en.wikipedia.org/wiki/Artz_Building>
    - <https://en.wikipedia.org/wiki/Lake%E2%80%93Peterson_House>
    - <https://en.wikipedia.org/wiki/Mier_Wolf_House>
    - <https://en.wikipedia.org/wiki/Cheddar_Man>
    - <https://en.wikipedia.org/wiki/John_Borrer>
    - <https://en.wikipedia.org/wiki/Johann_Caspar_Scheuchzer>
    - <https://en.wikipedia.org/wiki/Goddard_Bridge>
  - Ambiguous pages, where the text itself lists more than one answer:
    - <https://en.wikipedia.org/wiki/Languages_of_Switzerland>
    - <https://en.wikipedia.org/wiki/Monty_Python_and_the_Holy_Grail>
    - <https://en.wikipedia.org/wiki/Good_Omens>
    - <https://en.wikipedia.org/wiki/Centre_Pompidou>
    - <https://en.wikipedia.org/wiki/UEFA_Euro_2008>
    - <https://en.wikipedia.org/wiki/List_of_countries_with_multiple_capitals>
  - Reuse allowed: copy the short quoted facts into the repo, with attribution by URL.
  - Verdict: copy allowed.
- **NASA**
  - Data license: public domain in the US unless a page says otherwise. Source: <https://www.nasa.gov/mission/apollo-11/>.
  - Reuse allowed: copy the quoted facts into the repo.
  - Verdict: copy allowed.

## Fresh task sources

`scripts/bench/tasks/generate-fresh.ts` builds `fresh.jsonl` from three live sources.
Each task keeps its source URL, the source date, and the license below.

- **arXiv API** (<https://export.arxiv.org/api/query>): `search.fresh` tasks. The metadata is CC0-1.0, per <https://info.arxiv.org/help/license/index.html>.
- **Wikipedia API** (`list=recentchanges`, then `prop=extracts`): `search.fresh` tasks in six editions. The text is CC BY-SA 4.0.
- **Wikidata Query Service** (<https://query.wikidata.org/sparql>): fresh `answer.short` tasks. The data is CC0-1.0.

## Known limits

- **Multilingual queries are not written by native speakers.** The spec asks for `search.multilingual` queries written by native speakers. These queries are Wikidata labels in each language, set into fixed question templates. No cited source with a fitting license gives native-written queries. BrowseComp-ZH is internal only, so its rows are not copied. Read scores on these tasks as label-matching scores, not as scores on natural native queries. A native speaker should rewrite each query before the set meets this part of the spec.
- **Fresh Wikidata answers follow recent edits.** Each fresh `answer.short` gold value is the statement on the cited entity page at build time. A recent edit can be wrong or vandalized, so check a sample of rows against the entity page before trusting the set.
