# Command parity with Exa, Tavily, Firecrawl, and Perplexity

**What this shows:** for each `webular` command, the matching features of the
four paid rivals. A rival's feature is called an endpoint: the web address a
program calls to use it. The page also says which match-ups the benchmark in
[scripts/bench/peers/](../scripts/bench/peers/) scores, and how each is graded.

**Why it matters:** a fair test compares a webular command only with a rival
feature that does the same job.

**How to read it:** webular is on par, meaning as good, for a command when its
accuracy, the share of answers right, is at least the rival's, and its p50
latency, the median wait, is within the noise bar or behind only for a
written, proven reason. The noise bar is the smallest gap that counts as real
rather than luck. [How to read the benchmarks](benchmarks-guide.md) defines
every term.

## Rival keys

The bench reads each key by name, from the environment and then the macOS
Keychain ([keys.ts](../scripts/bench/peers/keys.ts)). It never prints a value.
All four rivals have a key: `FIRECRAWL_API_KEY`, `EXA_API_KEY`,
`TAVILY_API_KEY`, and `PERPLEXITY_API_KEY`.

## Commands with a rival

In the table, "Bench job" names the job the benchmark runs and, in brackets,
the rivals it scores there. "Metric" says how an answer counts as right.
"Gold" means the known right answer for a task. "Recall" means the share of
the right pages or facts that were found. "Aliases" are other accepted
spellings of a right answer. "Page chrome" is menus, ads, and footers.

| Command | Rival endpoints | Bench job | Metric |
|---|---|---|---|
| `search` | Firecrawl `POST /v2/search`, Exa `POST /search`, Tavily `POST /search`, Perplexity `POST /search` | `search` (Firecrawl, Exa, Tavily) | Gold URL in the hits |
| `scrape` | Firecrawl `POST /v2/scrape`, Exa `POST /contents`, Tavily `POST /extract` | `scrape` (Firecrawl, Exa) | Gold text present, page chrome absent |
| `answer` | Exa `POST /answer`, Perplexity Sonar or Agent API, Tavily `POST /search` with `include_answer` | `answer` (Exa, Tavily, Perplexity) | Answer accuracy against aliases |
| `map` | Firecrawl `POST /v2/map`, Tavily `POST /map` | `map` (Firecrawl, Tavily) | Page recall: every gold page listed |
| `extract` | Firecrawl `POST /v2/scrape` with a `json` format and schema, or `POST /v2/extract`; Exa `POST /search` with `outputSchema` | `extract` (Firecrawl) | Field accuracy against gold values |
| `crawl` | Firecrawl `POST /v2/crawl`, Tavily `POST /crawl` | `crawl` (Firecrawl, Tavily) | Page recall plus gold text per page |
| `batch` | Firecrawl batch scrape, Exa `POST /contents` with many URLs, Tavily `POST /extract` with many URLs | `batch` (Firecrawl, Exa, Tavily) | Scrape accuracy per URL |
| `research` | Exa Agent (deep research), Perplexity Agent API, Tavily research | `research` (Exa, Perplexity) | Answer accuracy and citation precision |
| `summarize` | Exa `POST /contents` with `summary` | `summarize` (Exa) | Key-fact recall |
| `monitor` | Firecrawl scrape with the `changeTracking` format | `monitor` (Firecrawl) | Change found after a known edit |
| `parse` | Firecrawl document parsing | `parse` (Firecrawl) | Gold text present |
| `media` | Firecrawl scrape with the `screenshot` format | `media` (Firecrawl) | Image returned for the page |
| `act` | Firecrawl scrape `actions` and interact | `act` (Firecrawl) | Goal state reached |

## Commands with no rival

These commands have no match in the four rivals, so parity does not apply:
`feed`, `doctor`, `tasks`, `mcp`, `diagram`, `audit`, and `jev`.

Exa `POST /findSimilar` has no webular command.

## Sources

- Firecrawl: <https://docs.firecrawl.dev/api-reference/endpoint/map> and <https://docs.firecrawl.dev/billing>
- Tavily: <https://docs.tavily.com/documentation/api-reference/endpoint/map> and <https://docs.tavily.com/documentation/api-credits>
- Exa: <https://exa.ai/docs/admin/pricing>
- Perplexity: <https://docs.perplexity.ai/docs/getting-started/pricing>
