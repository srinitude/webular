# Built task sources

## Why this file exists

Some benchmark tasks are built here instead of copied from a public set.
This file names the source and license behind each built task, and the limits a reader should know.
The licenses of the public sets are in [LICENSES.md](LICENSES.md).

## Hand-curated answer sources

These pages back the tasks in [`scripts/bench/tasks/answer-seed.json`](../../scripts/bench/tasks/answer-seed.json).
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

[`scripts/bench/tasks/generate-fresh.ts`](../../scripts/bench/tasks/generate-fresh.ts) builds `fresh.jsonl` from three live sources.
Each task keeps its source URL, the source date, and the license below.

- **arXiv API** (<https://export.arxiv.org/api/query>): `search.fresh` tasks. The metadata is CC0-1.0, per <https://info.arxiv.org/help/license/index.html>.
- **Wikipedia API** (`list=recentchanges`, then `prop=extracts`): `search.fresh` tasks in six editions. The text is CC BY-SA 4.0.
- **Wikidata Query Service** (<https://query.wikidata.org/sparql>): fresh `answer.short` tasks. The data is CC0-1.0.

## Image pilot sources

[`dev/pilot-images.jsonl`](dev/pilot-images.jsonl) holds the 28 image pilot tasks: 6 charts, 5 table images, 5 scans, 4 product photos, 4 diagrams, and 4 infographics.
Each task runs a text-only arm and an image arm on the same page.

Each gold answer was read from the image on 2026-10-21.
Each one was also checked to be missing from the page text: the Firecrawl markdown, the alt text, and the captions.
So only the image arm can answer it.
The `gold.checked` field of each row says how its answer was read and checked, and `gold.evidence_place` says where in the image it sits.

| Task | URL | License | Gold | Captured |
| --- | --- | --- | --- | --- |
| pilot-images-chart-01 | <https://ourworldindata.org/grapher/life-expectancy?tab=chart&country=JPN> | CC-BY-4.0 | 1865 | 2026-10-21 |
| pilot-images-chart-02 | <https://ourworldindata.org/grapher/unemployment-rate?tab=chart&country=USA~OWID_WRL> | CC-BY-4.0 | 2010 | 2026-10-21 |
| pilot-images-chart-03 | <https://ourworldindata.org/grapher/temperature-anomaly?tab=chart> | CC-BY-4.0 | 2024 | 2026-10-21 |
| pilot-images-chart-04 | <https://www.eia.gov/energyexplained/us-energy-facts/> | US-public-domain | 8.2 | 2026-10-21 |
| pilot-images-chart-05 | <https://www.cdc.gov/nchs/products/databriefs/db492.htm> | US-public-domain | 18.4 | 2026-10-21 |
| pilot-images-chart-06 | <https://en.wikipedia.org/wiki/Keeling_Curve> | CC-BY-SA-4.0 | µmol/mol | 2026-10-21 |
| pilot-images-table-01 | <https://commons.wikimedia.org/wiki/File:Mendelejevs_periodiska_system_1871.png> | public-domain | 40 | 2026-10-21 |
| pilot-images-table-02 | <https://pubs.usgs.gov/wri/wri004198/> | US-public-domain | -0.066 | 2026-10-21 |
| pilot-images-table-03 | <https://ntrs.nasa.gov/api/citations/19930091395/downloads/19930091395.pdf> | US-public-domain | 112,000 | 2026-10-21 |
| pilot-images-table-04 | <https://pubs.usgs.gov/wri/wri004198/> | US-public-domain | 6,800 | 2026-10-21 |
| pilot-images-table-05 | <https://www.census.gov/library/visualizations/2025/demo/top-5-largest-population-increases-2023-2024.html> | US-public-domain | 87,184 | 2026-10-21 |
| pilot-images-scan-01 | <https://archive.org/details/originofspecies00darwuoft> | public-domain | naturally selected | 2026-10-21 |
| pilot-images-scan-02 | <https://patents.google.com/patent/US223898A> | US-public-domain | 186 | 2026-10-21 |
| pilot-images-scan-03 | <https://www.loc.gov/resource/sn83030214/1912-04-16/ed-1/?sp=1> | public-domain | 1,340 | 2026-10-21 |
| pilot-images-scan-04 | <https://ntrs.nasa.gov/citations/19650003011> | US-public-domain | Windsor L. Sherman | 2026-10-21 |
| pilot-images-scan-05 | <https://commons.wikimedia.org/wiki/File:The_biology_of_the_frog_(Page_273,_Fig._75)_BHL7720636.jpg> | public-domain | Venous system of the frog seen from the dorsal side. | 2026-10-21 |
| pilot-images-product-01 | <https://world.openfoodfacts.org/product/3017620422003> | CC-BY-SA-3.0 | orange | 2026-10-21 |
| pilot-images-product-02 | <https://world.openfoodfacts.org/product/5449000000996> | CC-BY-SA-3.0 | 8400kJ/2000kcal | 2026-10-21 |
| pilot-images-product-03 | <https://commons.wikimedia.org/wiki/File:Products_Products_Products_(3523437544).jpg> | CC-BY-SA-2.0 | Fire | 2026-10-21 |
| pilot-images-product-04 | <https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/j-m-smucker-co-issues-voluntary-recall-select-jifr-products-sold-us-potential-salmonella> | US-public-domain | APR 22 2024 | 2026-10-21 |
| pilot-images-diagram-01 | <https://commons.wikimedia.org/wiki/File:Schematic_diagram_of_the_human_eye_en.svg> | CC-BY-SA-3.0 | Optic disc | 2026-10-21 |
| pilot-images-diagram-02 | <https://patents.google.com/patent/US174465A> | US-public-domain | A | 2026-10-21 |
| pilot-images-diagram-03 | <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview> | CC-BY-SA-2.5 | 2 | 2026-10-21 |
| pilot-images-diagram-04 | <https://www.nasa.gov/missions/artemis/artemis-ii-map/> | US-public-domain | 4,047 miles | 2026-10-21 |
| pilot-images-infographic-01 | <https://www.cdc.gov/healthy-schools/web-graphics/index.html> | US-public-domain | 7 out of 10 | 2026-10-21 |
| pilot-images-infographic-02 | <https://www.nhlbi.nih.gov/resources/copd-portraits-lung-health-any-age-infographic> | US-public-domain | Not smoking | 2026-10-21 |
| pilot-images-infographic-03 | <https://www.census.gov/library/visualizations/2026/comm/median-household-income.html> | US-public-domain | $87,460 | 2026-10-21 |
| pilot-images-infographic-04 | <https://www.ready.gov/publications> | US-public-domain | Save for a Rainy Day | 2026-10-21 |

## Known limits

- **Multilingual queries are not written by native speakers.** The spec asks for `search.multilingual` queries written by native speakers. These queries are Wikidata labels in each language, set into fixed question templates. No cited source with a fitting license gives native-written queries. BrowseComp-ZH is internal only, so its rows are not copied. Read scores on these tasks as label-matching scores, not as scores on natural native queries. A native speaker should rewrite each query before the set meets this part of the spec.
- **Fresh Wikidata answers follow recent edits.** Each fresh `answer.short` gold value is the statement on the cited entity page at build time. A recent edit can be wrong or vandalized, so check a sample of rows against the entity page before trusting the set.
- **Some image pilot pages differ from the pilot plan.**
  - Chart-02 and chart-03 use Our World in Data pages, not BLS and climate.gov. The BLS chart is drawn in the browser, and its alt text gives the answer. The climate.gov static image stops at 2022.
  - No arXiv results table set as an image was found, so table-02 and table-04 share one USGS page.
  - Table-05 is a labeled graphic panel, not a ruled table.
  - Table-03, infographic-02, and infographic-04 are one-page PDFs, not image files.
  - The product-04 photo was supplied by the company and is posted on an FDA page.
