# Research status

This page shows how much research backs webular and how much of it is in the code. Each ranked change from the research is marked applied, rejected, or open. The papers and the change lists are in [the research ledger](research/README.md).

## What was read

- Papers: 4,382 distinct arXiv ids across the raw research ledgers, counted with version suffixes dropped. Of these, 4,295 were read from the abstract or the full text, and 1,069 were read in full. The other 87 were screened by title only. The published ledger, [`papers.jsonl`](research/papers.jsonl), keeps its own counts in [its README](research/README.md).
- Dependency repos: 24 GitHub repos behind webular's packages and tools, from `biomejs/biome` to `webreflection/linkedom`.
- Ranked changes: 175 in all, from six topic lists, the dependencies top 10, and 77 dependency rows.

## Topic coverage

Distinct papers per topic group (a paper can sit in more than one):

- Engineering: 1,260.
- Full-text pass: 860.
- Answer quality: 775.
- Agents: 702.
- Top-up pass: 606.
- Retrieval: 569.
- Decision models: 556.
- Extraction: 550.

Extraction, decision models, and retrieval are the thinnest. The agents list also names gaps with no papers read: WebArena, GAIA, FRAMES, SimpleQA, HLE, search-API comparisons, and tool-use RL.

## How each change was marked

Each change was checked against the code with a search for the file and the behavior it names:

- Applied: the change is in the code, with a file and line.
- Rejected: the change does not fit, with the reason.
- Open: the change is not in the code, or only part of it is ("partly").

An open mark means the search did not find the whole change. It does not prove the code lacks it.

## Totals

| Source | Items | Applied | Rejected | Open | Of open, partly |
| --- | ---: | ---: | ---: | ---: | ---: |
| Retrieval | 14 | 1 | 0 | 13 | 8 |
| Extraction | 14 | 7 | 0 | 7 | 5 |
| Answer quality | 10 | 1 | 0 | 9 | 4 |
| Decision models | 13 | 0 | 0 | 13 | 0 |
| Agents and AGENTS.md | 19 | 3 | 0 | 16 | 4 |
| Engineering | 18 | 3 | 0 | 15 | 2 |
| Dependencies top 10 | 10 | 2 | 0 | 8 | 0 |
| Dependency rows | 77 | 25 | 1 | 51 | 2 |
| **All** | **175** | **42** | **1** | **132** | **25** |

## Applied

- Retrieval #13: source scores as hit rate over latency, `src/lib/search-source-score.ts:6`.
- Extraction #1 and #2: crawl yield counts and URL-shape priority, `src/lib/crawl-priority.ts:1` and `:10`.
- Extraction #5 and #6: PDF XY-Cut columns and repeated-line drop, `src/lib/parse-pdf-layout.ts:1` and `src/lib/parse-pdf.ts:54`.
- Extraction #8: a formula keeps its alt text, TeX source, or plain text when MathML is stripped, `src/lib/html-sanitize.ts:78`.
- Extraction #9: alt text stops at 300 characters, and the image list skips hidden images, `src/lib/html-images.ts:30` and `:38`.
- Extraction #14: the archive fallback keeps only HTML captures that returned status 200, `src/lib/archive-urls.ts:14`.
- Answer quality #8: a bench judge that changes 2% or more of its labels on swapped answer order is refused, `scripts/bench/judge.ts:28` and `:62`.
- Agents #2: the MCP server's directive and worked example, `plugins/webular/src/descriptions.json:3`.
- AGENTS.md #2 and #6: a short intro with no project map, and nested files under their size caps.
- Engineering #7: when a site fails with a 5xx after the last retry, the stored copy comes back marked stale (`src/lib/fetch-http.ts:115`). Calls for one URL at the same time share one request (`src/lib/fetch-layer.ts:59`).
- Engineering #13: shuffled test order, the `test:shuffled` task in [`mise.toml`](../mise.toml).
- Engineering #18: each Markdown image becomes a marked plain link that loads nothing until someone opens it, `src/lib/html-images.ts:91`.
- Dependencies top 10 #8: bounded parsers. `diff` uses `maxEditLength` (`src/lib/snapshot.ts:35`), `unpdf` uses `maxImageSize` (`src/lib/parse-pdf.ts:125`), and Readability skips pages past `READABLE_MAX_CHARS` ([`src/lib/html.ts`](../src/lib/html.ts)).
- Dependencies top 10 #5: a SIGTERM during startup still exits 143, `tests/cli/dispatch.test.ts:142`.
- Dependency rows #45 (the Readability cap above) and #37 (`Object.hasOwn` for tool names, [`src/tools/sdk-errors.ts`](../src/tools/sdk-errors.ts)).
- Dependency row #56: a `<br>` inside `<pre>` stays a line break in Markdown, `src/lib/html-sanitize.ts:84`.
- Dependency row #53: `WEBULAR_DOCX_TIMEOUT_MS` bounds one docx conversion, `src/lib/parse.ts:74`.
- Dependency rows #54, #58, #60, #62, #66: mammoth messages logged, `maxImageSize`, `maxEditLength`, the TypeScript pin, and the Biome exclude.
- Dependency rows #6, #8, #11, #12, #16, #17, #20, #24 to #28, #47, #57, #61, #76: keep-pin or informational rows that need no code.

## Rejected

- Dependency row #63: `@typescript/typescript6` is in `package.json:96`, so the reported cause was a setup fault, not a code fault.

## Open

Every open item and its next step is in [open-items.md](research/open-items.md). The items that change a Jev payload or decision need a decision-models-first receipt before any work starts.
