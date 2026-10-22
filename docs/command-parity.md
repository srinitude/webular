# Command parity with Exa, Tavily, Firecrawl, and Perplexity

This page maps each `webular` command to the rival endpoints that do the same
job. It shows which ones the peer bench in
[scripts/bench/peers/](../scripts/bench/peers/) scores, and the metric that fits.
Webular is on par for a command when its accuracy is at least the rival's,
and its p50 latency is within the noise bar or behind only by a written,
evidenced ceiling.

## Rival keys

The bench reads each key by name, from the environment and then the macOS
Keychain ([keys.ts](../scripts/bench/peers/keys.ts)). It never prints a value.
All four rivals have a key: `FIRECRAWL_API_KEY`, `EXA_API_KEY`,
`TAVILY_API_KEY`, and `PERPLEXITY_API_KEY`.

## Commands with a rival

| Command | Rival endpoints | Bench job | Metric |
|---|---|---|---|
| `search` | Firecrawl `POST /v2/search`, Exa `POST /search`, Tavily `POST /search`, Perplexity `POST /search` | `search` (Firecrawl, Exa, Tavily) | Gold URL in the hits |
| `scrape` | Firecrawl `POST /v2/scrape`, Exa `POST /contents`, Tavily `POST /extract` | `scrape` (Firecrawl, Exa) | Gold text present, page chrome absent |
| `answer` | Exa `POST /answer`, Perplexity Sonar or Agent API, Tavily `POST /search` with `include_answer` | `answer` (Exa, Tavily, Perplexity) | Answer accuracy against aliases |
| `map` | Firecrawl `POST /v2/map`, Tavily `POST /map` | `map` (Firecrawl, Tavily) | Page recall: every gold page listed |
| `extract` | Firecrawl `POST /v2/scrape` with a `json` format and schema, or `POST /v2/extract`; Exa `POST /search` with `outputSchema` | `extract` (Firecrawl) | Field accuracy against gold values |
| `crawl` | Firecrawl `POST /v2/crawl`, Tavily `POST /crawl` | none | Page recall plus gold text per page |
| `batch` | Firecrawl batch scrape, Exa `POST /contents` with many URLs, Tavily `POST /extract` with many URLs | none | Scrape accuracy per URL |
| `research` | Exa Agent (deep research), Perplexity Agent API, Tavily research | none | Answer accuracy and citation precision |
| `summarize` | Exa `POST /contents` with `summary` | none | Key-fact recall |
| `monitor` | Firecrawl scrape with the `changeTracking` format | none | Change found after a known edit |
| `parse` | Firecrawl document parsing | none | Gold text present |
| `media` | Firecrawl scrape with the `screenshot` format | none | Image returned for the page |
| `act` | Firecrawl scrape `actions` and interact | none | Goal state reached |

## Commands with no rival

These commands have no match in the four rivals, so parity does not apply:
`feed`, `doctor`, `tasks`, `mcp`, `diagram`, `audit`, and `jev`.

Exa `POST /findSimilar` has no webular command.

## Sources

- Firecrawl: <https://docs.firecrawl.dev/api-reference/endpoint/map> and <https://docs.firecrawl.dev/billing>
- Tavily: <https://docs.tavily.com/documentation/api-reference/endpoint/map> and <https://docs.tavily.com/documentation/api-credits>
- Exa: <https://exa.ai/docs/admin/pricing>
- Perplexity: <https://docs.perplexity.ai/docs/getting-started/pricing>
