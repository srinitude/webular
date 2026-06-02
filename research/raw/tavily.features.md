# Tavily — Web Feature Catalog for webular

**Coverage:** 100 total URLs in inventory · 31 pre-selected pages deep-read · remaining 69 URLs categorized by path/title.

---

## URL Inventory Categorization

| Bucket | URLs |
|--------|------|
| **search** | `/documentation/api-reference/endpoint/search`, `/examples/quick-tutorials/search-api`, `/documentation/best-practices/best-practices-search` |
| **extract / scrape** | `/documentation/api-reference/endpoint/extract`, `/examples/quick-tutorials/extract-api`, `/documentation/best-practices/best-practices-extract` |
| **crawl** | `/documentation/api-reference/endpoint/crawl`, `/examples/quick-tutorials/crawl-api`, `/documentation/best-practices/best-practices-crawl` |
| **map (sitemap/URL discovery)** | `/documentation/api-reference/endpoint/map`, `/examples/quick-tutorials/map-api` |
| **research / answer-summarize** | `/documentation/api-reference/endpoint/research`, `/documentation/api-reference/endpoint/research-get`, `/documentation/api-reference/endpoint/research-streaming`, `/documentation/best-practices/best-practices-research`, `/examples/quick-tutorials/research-streaming` |
| **proxy / keyless / payments** | `/documentation/keyless`, `/documentation/machine-payments/x402` |
| **SDK / tooling** | `/sdk/python/quick-start`, `/sdk/python/reference`, `/sdk/javascript/quick-start`, `/sdk/javascript/reference`, `/documentation/tavily-cli`, `/documentation/agent-skills` |
| **MCP / integrations** | `/documentation/mcp`, `/documentation/integrations/*` (20 pages: langchain, llamaindex, crewai, agno, pydantic-ai, flowise, composio, make, zapier, n8n, dify, openclaw, langflow, anthropic, openai, claude, devin, google-adk, mastra, etc.), `/examples/agent-toolkit/*` |
| **auth / account / enterprise** | `/documentation/api-reference/endpoint/usage`, `/documentation/api-reference/introduction`, `/documentation/rate-limits`, `/documentation/best-practices/api-key-management`, `/documentation/enterprise/*` (4 pages), `/documentation/api-credits` |
| **examples / use-cases** | `/examples/use-cases/*` (6 pages: chat, company-research, crawl-to-rag, data-enrichment, market-researcher, meeting-prep), `/examples/agent-toolkit/*` (6 pages), `/examples/hub`, `/examples/quick-tutorials/*` |
| **crawler policy / other** | `/documentation/search-crawler`, `/documentation/about`, `/documentation/quickstart`, `/welcome`, `/changelog`, `/faq/faq`, `/llms.txt`, `/sitemap.xml`, `/agents` |
| **partnerships** | `/documentation/partnerships/*` (5 pages: amazon, azure, databricks, ibm, snowflake) |
| **open source / community** | `/examples/open-sources/projects`, `/examples/open-sources/gpt-researcher` |

---

## Feature Deep-Read

### 1. Tavily Search (`POST /search`)

**Purpose:** AI-optimized web search returning ranked, relevance-scored results plus optional LLM-generated answers. Aggregates up to 20 sources per call, handles scraping/filtering/ranking server-side.

**Key parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `query` | string | required | Natural-language query, keep under 400 chars |
| `search_depth` | enum | `basic` | `ultra-fast` / `fast` / `basic` / `advanced`; advanced costs 2 credits |
| `chunks_per_source` | int 1–3 | 3 | Reranked 500-char snippets; only with `advanced` depth |
| `max_results` | int 0–20 | 5 | |
| `topic` | enum | `general` | `general` / `news` / `finance` |
| `time_range` | enum | — | `day` / `week` / `month` / `year` |
| `start_date` / `end_date` | string YYYY-MM-DD | — | Absolute date filter on publish/updated date |
| `include_answer` | bool or `basic`/`advanced` | false | LLM-synthesized answer |
| `include_raw_content` | bool or `markdown`/`text` | false | Full parsed HTML content per result |
| `include_images` | bool | false | Top-level image list + per-result images |
| `include_image_descriptions` | bool | false | Requires `include_images` |
| `include_favicon` | bool | false | |
| `include_domains` | string[] max 300 | — | Allowlist |
| `exclude_domains` | string[] max 150 | — | Blocklist |
| `country` | enum | — | 150+ countries; boosts results from that country; only with `general` topic |
| `auto_parameters` | bool | false | Tavily auto-selects depth/topic/time_range; costs 2 credits |
| `exact_match` | bool | false | Requires verbatim phrase(s) in quotes inside query |
| `include_usage` | bool | false | Credit usage in response |
| `safe_search` | bool | false | Enterprise only; not supported for fast/ultra-fast |

**Response fields:** `query`, `answer`, `images[]`, `results[]{title, url, content, score, raw_content, favicon, images[]}`, `response_time`, `auto_parameters`, `usage{credits}`, `request_id`

**FOSS alternatives for webular:**

- Web search: `duckduckgo-search` (npm: `duck-duck-scrape`; pypi: `duckduckgo-search`), SearXNG (self-hosted metasearch), Brave Search free API (2000 req/month), Common Crawl index queries via `cdx-toolkit`
- Relevance scoring / reranking: `cross-encoder/ms-marco-*` via `sentence-transformers` (pypi), `@xenova/transformers` (npm)
- LLM-generated answers: any local LLM (Ollama, llama.cpp) fed search snippets
- News/time-filter: `feedparser` (pypi), `newspaper4k` (pypi) for RSS/Atom; `gnews` (pypi)

---

### 2. Tavily Extract (`POST /extract`)

**Purpose:** Clean content extraction from one or many URLs. Handles JS-rendered pages, removes boilerplate, returns markdown or plain text. Batch up to 20 URLs per call. Supports query-focused chunk reranking.

**Key parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `urls` | string or string[] | required | Up to 20 URLs per call |
| `query` | string | — | Reranks content chunks by relevance when provided |
| `chunks_per_source` | int 1–5 | 3 | Only when `query` provided; max 500 chars per chunk |
| `extract_depth` | enum | `basic` | `basic` (static HTML, 1 credit/5 URLs) / `advanced` (JS render, tables, 2 credits/5 URLs) |
| `include_images` | bool | false | |
| `include_favicon` | bool | false | |
| `format` | enum | `markdown` | `markdown` / `text` |
| `timeout` | float 1–60 | varies | 10s default for basic, 30s for advanced |
| `include_usage` | bool | false | |

**Response fields:** `results[]{url, raw_content, images[], favicon}`, `failed_results[]{url, error}`, `response_time`, `usage`, `request_id`

**FOSS alternatives for webular:**

- JS rendering + HTML fetch: `playwright` (npm/pypi), `puppeteer` (npm), `playwright-chromium`
- HTML parsing / boilerplate removal: `@mozilla/readability` (npm), `readability-lxml` (pypi), `trafilatura` (pypi), `goose3` (pypi), `newspaper4k` (pypi)
- HTML-to-markdown: `turndown` (npm), `html2text` (pypi), `markdownify` (pypi)
- Plain fetch (static): `undici` / `node-fetch` (npm), `httpx` (pypi), `aiohttp` (pypi)
- Anti-bot / stealth: `puppeteer-extra-plugin-stealth` (npm), `cloudscraper` (pypi)

---

### 3. Tavily Crawl (`POST /crawl`)

**Purpose:** Graph-based website traversal with parallel path exploration. Extracts full page content from all discovered pages. Supports natural language instructions for semantic filtering of which pages to visit.

**Key parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `url` | string | required | Root URL |
| `instructions` | string | — | NL guidance; doubles cost to 2 credits/10 pages |
| `chunks_per_source` | int 1–5 | 3 | Only when `instructions` provided |
| `max_depth` | int 1–5 | 1 | Levels from root; exponential time growth |
| `max_breadth` | int 1–500 | 20 | Links per page |
| `limit` | int | 50 | Total page cap |
| `select_paths` | string[] (regex) | — | Allowlist path patterns |
| `select_domains` | string[] (regex) | — | Allowlist domains/subdomains |
| `exclude_paths` | string[] (regex) | — | Blocklist path patterns |
| `exclude_domains` | string[] (regex) | — | Blocklist domains |
| `allow_external` | bool | true | Follow external links |
| `include_images` | bool | false | |
| `extract_depth` | enum | `basic` | `basic` / `advanced` |
| `format` | enum | `markdown` | `markdown` / `text` |
| `include_favicon` | bool | false | |
| `timeout` | float 10–150 | 150 | |
| `include_usage` | bool | false | |

**Response fields:** `base_url`, `results[]{url, raw_content, favicon}`, `response_time`, `usage`, `request_id`

**CLI extra:** `--output-dir ./path/` saves each crawled page as a separate `.md` file.

**FOSS alternatives for webular:**

- BFS crawlers: `crawlee` (npm, Apify's FOSS crawler), `simplecrawler` (npm), `scrapy` (pypi), custom BFS with `undici` + `cheerio` (npm) or `httpx` + `beautifulsoup4` (pypi)
- Link extraction: `cheerio` (npm), `beautifulsoup4` (pypi), `selectolax` (pypi)
- Robots.txt / politeness: `robots-parser` (npm), `robotparser` (Python stdlib), `tldextract` (pypi)
- Markdown output per page: `turndown` (npm), `markdownify` (pypi)

---

### 4. Tavily Map (`POST /map`)

**Purpose:** URL-only site structure discovery — crawls a website graph-style but returns only the list of discovered URLs, not content. Significantly faster and cheaper than Crawl. Designed for "map then extract" workflows.

**Key parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `url` | string | required | |
| `instructions` | string | — | NL URL filter; costs 2 credits/10 pages |
| `max_depth` | int 1–5 | 1 | |
| `max_breadth` | int 1–500 | 20 | |
| `limit` | int | 50 | |
| `select_paths` | string[] (regex) | — | |
| `select_domains` | string[] (regex) | — | |
| `exclude_paths` | string[] (regex) | — | |
| `exclude_domains` | string[] (regex) | — | |
| `allow_external` | bool | true | |
| `timeout` | float 10–150 | 150 | |
| `include_usage` | bool | false | |

**Response fields:** `base_url`, `results` (string[] of URLs), `response_time`, `usage`, `request_id`

**FOSS alternatives for webular:**

- Sitemap parsing: `sitemapper` (npm), `sitemap-parser` (npm), `usp` (pypi: `ultimate-sitemap-parser`)
- URL discovery BFS (links only): `link-extractor` (npm), custom BFS with `node-fetch` + `cheerio` extracting `<a href>` tags
- robots.txt sitemap hint: `robots-txt-guard` (npm), Python stdlib `urllib.robotparser`

---

### 5. Tavily Research — Create Task (`POST /research`)

**Purpose:** Deep multi-step research agent. Internally executes multiple searches, analyzes sources, and synthesizes a comprehensive cited report or structured JSON output. Two models: `mini` (targeted, narrow) and `pro` (comprehensive, multi-angle with `ResearchSubtopic` sub-agents).

**Key parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `input` | string | required | Research question/task |
| `model` | enum | `auto` | `mini` / `pro` / `auto` |
| `stream` | bool | false | SSE stream if true |
| `output_schema` | object (JSON Schema) | — | Structures response; must include `properties` |
| `citation_format` | enum | `numbered` | `numbered` / `mla` / `apa` / `chicago` |
| `include_domains` | string[] max 20 | — | Soft domain preference |
| `exclude_domains` | string[] max 20 | — | Hard domain blocklist |
| `output_length` | enum | `standard` | `short` / `standard` / `long` |

**Response (201):** `request_id`, `created_at`, `status` (`pending`), `input`, `model`, `response_time`

**FOSS alternatives for webular:**

- Orchestrated multi-step research: `gpt-researcher` (pypi; fully open-source), `langchain` research agents (npm/pypi), `mastra` workflow chains (npm)
- SSE streaming: `eventsource` (npm), `httpx-sse` (pypi), built-in `fetch` with ReadableStream (Bun)

---

### 6. Tavily Research — Get Task Status (`GET /research/{request_id}`)

**Purpose:** Polls the status and retrieves the completed research report or structured output. Returns `completed` (with `content` + `sources[]`) or `failed`.

**Response fields:** `request_id`, `created_at`, `status`, `content` (string or object), `sources[]{title, url, favicon}`, `response_time`

**FOSS alternatives:** Any HTTP polling loop; `p-retry` (npm), `tenacity` (pypi)

---

### 7. Tavily Research Streaming (SSE)

**Purpose:** Real-time streaming of research progress as Server-Sent Events in OpenAI chat completion chunk format. Emits five event types as research executes.

**SSE Event Types:**

| Event | `delta` shape | Notes |
|-------|---------------|-------|
| Tool call (`tool_calls.type = "tool_call"`) | `name`, `id`, `arguments`, `queries[]` | Tools: `Planning`, `WebSearch`, `Generating`, `ResearchSubtopic` (Pro only) |
| Tool response (`tool_calls.type = "tool_response"`) | `name`, `id`, `arguments`, `sources[]{url,title,favicon}` | |
| Content | `content`: string or object | Streamed report chunks |
| Sources | `sources[]` | All sources used |
| Done | `event: done` | Stream complete |

**FOSS alternatives:** SSE streaming with any self-hosted research pipeline; `eventsource-parser` (npm)

---

### 8. Tavily Usage API (`GET /usage`)

**Purpose:** Retrieve current API key and account-level usage (credits used/limit, broken down by endpoint: search, extract, crawl, map, research). Supports `X-Project-ID` header for per-project scoping.

**Response fields:** `key{usage, limit, search_usage, extract_usage, crawl_usage, map_usage, research_usage}`, `account{current_plan, plan_usage, plan_limit, paygo_usage, paygo_limit, …}`

---

### 9. Python SDK (`tavily-python`)

**Clients:** `TavilyClient` (sync) + `AsyncTavilyClient` (async via `asyncio`)

**Methods:** `search(query, **params)`, `extract(urls, **params)`, `crawl(url, **params)`, `map(url, **params)`, `research(input, **params)`, `get_research(request_id)`

**Client constructor params:** `api_key`, `project_id` (or `TAVILY_PROJECT` env), `session_id`, `human_id`, `proxies`

**FOSS equivalent SDK pattern:** Any REST client wrapping the 5 endpoints; `httpx` (pypi) for async, `requests` (pypi) for sync.

---

### 10. JavaScript/TypeScript SDK (`@tavily/core`)

**Client:** `tavily({ apiKey })` — always async

**Methods:** `search(query, opts)`, `extract(url | url[], opts)`, `crawl(url, opts)`, `map(url, opts)`, `research(input, opts)`

**FOSS equivalent:** `node-fetch` / `undici` / Bun built-in `fetch` wrapping the REST API directly.

---

### 11. Tavily CLI (`tvly`)

**Purpose:** Terminal-native interface exposing all 5 core API endpoints plus REPL mode. Full JSON output mode for script/agent integration.

**Commands:**

| Command | Key Options |
|---------|-------------|
| `tvly search <query>` | `--depth`, `--max-results`, `--topic`, `--time-range`, `--start-date`, `--end-date`, `--include-domains`, `--exclude-domains`, `--country`, `--include-answer`, `--include-raw-content`, `--include-images`, `--chunks-per-source`, `-o`, `--json` |
| `tvly extract <url>...` | `--query`, `--chunks-per-source`, `--extract-depth`, `--format`, `--include-images`, `--timeout`, `-o`, `--json` |
| `tvly crawl <url>` | `--max-depth`, `--max-breadth`, `--limit`, `--instructions`, `--chunks-per-source`, `--extract-depth`, `--format`, `--select-paths`, `--exclude-paths`, `--select-domains`, `--exclude-domains`, `--allow-external`, `--include-images`, `--timeout`, `-o`, `--output-dir`, `--json` |
| `tvly map <url>` | `--max-depth`, `--max-breadth`, `--limit`, `--instructions`, `--select-paths`, `--exclude-paths`, `--select-domains`, `--exclude-domains`, `--allow-external`, `--timeout`, `-o`, `--json` |
| `tvly research <topic>` | `--model`, `--no-wait`, `--stream`, `--output-schema`, `--citation-format`, `--poll-interval`, `--timeout`, `-o`, `--json`; subcommands: `status <id>`, `poll <id>` |
| `tvly` (REPL) | Interactive mode, no `tvly` prefix needed |
| `tvly login / logout / auth` | API key or browser OAuth |

**Install:** `curl -fsSL https://cli.tavily.com/install.sh | bash` or `pip install tavily-cli` or `uv tool install tavily-cli`

---

### 12. Tavily MCP Server (`@tavily/mcp`)

**Purpose:** Model Context Protocol server exposing `tavily-search` and `tavily-extract` tools to MCP-compatible clients (Claude Desktop, Cursor, Windsurf, Claude Code, OpenAI, etc.).

**Connection modes:**
- **Remote URL:** `https://mcp.tavily.com/mcp/?tavilyApiKey=<key>` (or OAuth: `https://mcp.tavily.com/mcp/`)
- **Local (npx):** `npx -y tavily-mcp@latest`
- **Claude Code:** `claude mcp add tavily-remote-mcp --transport http https://mcp.tavily.com/mcp/`

**Auth:** Bearer token in URL param, or OAuth flow (PKCE). `mcp_auth_default` key in dashboard controls OAuth key selection.

**Default parameter injection:** `DEFAULT_PARAMETERS` header (remote) or env var (local) — sets global defaults for `include_images`, `search_depth`, `max_results`, etc.

**Session attribution:** Auto-attaches `X-Session-Id` per MCP session; optionally forwards `X-Human-Id`.

---

### 13. Keyless Access

**Purpose:** Zero-config access to Search and Extract for prototyping / autonomous agents that cannot manage credentials.

**How:** Send `X-Tavily-Access-Mode: keyless` header. Crawl/Map/Research require an API key. Same response schema as authenticated.

**Rate-limited.** Upgrade path: `Authorization: Bearer tvly-…` header.

---

### 14. x402 Machine Payments

**Purpose:** AI agents pay per-request via USDC on Base (EIP-3009 authorization). No API key, no account required. Designed for fully autonomous agent workflows.

**Flow:** POST /search → 402 + `PAYMENT-REQUIRED` header (base64 JSON with price envelope) → agent signs EIP-3009 → retry with `PAYMENT-SIGNATURE` header → 200 + result + `PAYMENT-RESPONSE` (receipt).

**Endpoint:** `POST https://x402.tavily.com/search`  
**Price:** $0.01 / call (USDC atomic unit 10000 = $0.01; 6 decimals)  
**Network:** Base mainnet (`eip155:8453`), USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  
**search_depth:** Always `advanced`; standard search params pass through.  
**Refunds:** Automatic on upstream failure.

**FOSS alternatives:** No direct free equivalent for trustless per-request crypto payments. Closest: `x402-js` library (npm); any EIP-3009 USDC transfer implementation on Base.

---

### 15. Tavily Agent Skills

**Purpose:** Agent Skill definitions (SKILL.md-style) for AI coding agents (Claude Code, Cursor, Cline, Codex, Windsurf). Installed via `npx skills add tavily-ai/skills`.

**Available skills:** `tavily-search`, `tavily-extract`, `tavily-crawl`, `tavily-map`, `tavily-research`, `tavily-best-practices`

Each skill wraps a `tvly` CLI call and can be invoked explicitly (`/tavily-search`, `/tavily-extract`, etc.) or auto-invoked based on agent reasoning.

---

### 16. Tavily Agent Toolkit (`tavily_agent_toolkit`)

**Purpose:** Python library of higher-level research primitives that combine multiple Tavily endpoints with context engineering (token management, deduplication, LLM synthesis).

**Tools:**

| Tool | Description | Key Params |
|------|-------------|------------|
| `search_and_answer` | Search + LLM synthesis with optional sub-queries | `query`, `model_config`, `max_number_of_subqueries` (2–4), `output_schema`, `token_limit` (default 50000), `threshold` (default 0.3), `topic`, `time_range`, `include_domains`, `exclude_domains` |
| `search_dedup` | Multi-query parallel search with URL deduplication + chunk merging | `queries[]`, `search_depth`, `topic`, `max_results`, `chunks_per_source`, `time_range`, `include_domains`, `exclude_domains` |
| `crawl_and_summarize` | Crawl site + LLM summarization | `url`, `model_config`, `instructions`, `output_schema`, `max_depth`, `max_breadth`, `limit`, `select_paths`, `exclude_paths` |
| `extract_and_summarize` | Extract URLs + LLM summarization | `urls[]` (max 20), `model_config`, `query`, `output_schema`, `chunks_per_source`, `extract_depth` |
| `social_media_search` | Domain-scoped social platform search | `query`, `platform` (`reddit`/`x`/`linkedin`/`tiktok`/`instagram`/`facebook`/`combined`), `include_raw_content`, `max_results`, `time_range` |

**ModelConfig:** `model=ModelObject(model="provider:model-id")`, `fallback_models[]`, `temperature`; supports 20+ providers via unified `"provider:model"` format.

**FOSS alternatives for webular:**
- Multi-query fan-out + dedup: custom `asyncio.gather` with `httpx` + URL dedup set; `crawlee` with `RequestQueue`
- Social media search: `praw` (pypi, Reddit), `tweepy` (pypi, X/Twitter), `instaloader` (pypi, Instagram)
- LLM synthesis: Ollama, `anthropic` SDK, `openai` SDK with any compatible model

---

### 17. Tavily Search Crawler (Policy)

**Purpose:** Tavily's own web indexing crawler for building its search index. Not an API endpoint.

**Policy notes:** Does not advertise a differentiated user agent (uses Googlebot coverage). Respects `noindex` directives. robots.txt does not prevent indexing (only `noindex` does).

---

### 18. Rate Limits

| Endpoint | Dev RPM | Prod RPM |
|----------|---------|---------|
| Search, Extract, Map | 100 | 1,000 |
| Crawl | 100 | 100 |
| Research (create) | 20 | 20 |
| Usage | 10 per 10 min | 10 per 10 min |

HTTP 429 response includes `retry-after` header (seconds). Production keys require paid plan or PAYGO enabled.

---

### 19. API Authentication & Tracking

**Base URL:** `https://api.tavily.com`

**Auth:** `Authorization: Bearer tvly-YOUR_API_KEY` header

**Project tracking:** `X-Project-ID` header (or `TAVILY_PROJECT` env var / SDK constructor param) — scopes usage filtering in `/usage` endpoint and dashboard.

**Session tracking:**
- `X-Session-Id` — groups all calls in one session (auto-populated by MCP server)
- `X-Human-Id` — per-end-user attribution (hashed by Tavily before storage)

---

## Cross-cutting FOSS Capability Map

This table maps each Tavily capability to concrete free & open-source libraries that webular can use as the underlying engine:

| Capability | FOSS Libraries (npm) | FOSS Libraries (pypi/other) |
|------------|---------------------|----------------------------|
| **Web search (no paid API)** | `duck-duck-scrape`, `ddg` | `duckduckgo-search`, SearXNG (self-hosted), Brave free tier |
| **News search** | `rss-parser`, `feedme` | `feedparser`, `gnews` |
| **Finance/stock data** | `yahoo-finance2` | `yfinance`, `yahooquery` |
| **Static page fetch** | `undici`, `node-fetch`, Bun built-in `fetch` | `httpx`, `aiohttp`, `requests` |
| **JS rendering / headless** | `playwright`, `puppeteer`, `puppeteer-extra-plugin-stealth` | `playwright` (pypi), `pyppeteer`, `selenium` |
| **HTML parsing** | `cheerio`, `parse5`, `htmlparser2` | `beautifulsoup4`, `lxml`, `selectolax` |
| **Boilerplate removal / readability** | `@mozilla/readability`, `@postlight/parser` | `trafilatura`, `goose3`, `newspaper4k`, `readability-lxml` |
| **HTML-to-Markdown** | `turndown`, `node-html-markdown` | `html2text`, `markdownify` |
| **BFS crawling** | `crawlee`, `simplecrawler`, `node-spider` | `scrapy`, `crawl4ai` |
| **Sitemap / URL discovery** | `sitemapper`, `sitemap-parser` | `ultimate-sitemap-parser` (`usp`), `sitemap` |
| **robots.txt** | `robots-parser`, `robots-txt-guard` | Python stdlib `urllib.robotparser`, `reppy` |
| **Relevance scoring / reranking** | `@xenova/transformers` (cross-encoders) | `sentence-transformers`, `FlagEmbedding` |
| **Semantic search / RAG** | `vectra`, `chromadb-js` | `chromadb`, `qdrant-client`, `faiss-cpu`, `weaviate-client` |
| **LLM answer synthesis** | Ollama API, `@anthropic-ai/sdk`, `openai` | `ollama`, `anthropic`, `openai`, `langchain` |
| **Multi-query fan-out** | `p-limit`, native `Promise.all` | `asyncio.gather`, `aiohttp` gather |
| **URL deduplication** | JS `Set` | Python `set` |
| **PDF extraction** | `pdf-parse`, `pdfjs-dist` | `pdf-parse`, `pymupdf`, `pdfminer.six` |
| **Image extraction** | `cheerio` `img[src]` selector | `beautifulsoup4` img tags |
| **SSE streaming** | `eventsource`, `eventsource-parser` | `httpx-sse`, `sseclient-py` |
| **Structured output schema** | `zod`, `ajv` | `pydantic` |
| **Research orchestration** | `mastra` (workflow/step), `langchain` agents | `gpt-researcher`, `langchain`, `langgraph` |
| **Social media** | — | `praw` (Reddit), `tweepy` (X/Twitter), `instaloader` (Instagram) |

---

## Unique Capabilities with No Direct FOSS Equivalent

1. **`auto_parameters`** — Tavily's proprietary intent-based query parameter auto-configuration. No FOSS equivalent; webular would need to implement its own prompt-to-param mapping.

2. **`social_media_search` (toolkit)** — cross-platform unified social search. Platform-specific free alternatives exist (`praw`, `tweepy`) but require per-platform auth and have stricter rate limits.

3. **`search_dedup` with semantic chunk merging** — merges content chunks from the same URL across multiple queries. Custom implementation required in webular.

4. **x402 machine payments** — USDC-on-Base per-request payment. Unique to Tavily; no FOSS equivalent for this exact payment primitive.

5. **Research `pro` model with `ResearchSubtopic` sub-agents** — multi-agent hierarchical research decomposition. Closest FOSS: `gpt-researcher` with multi-agent mode, or custom Mastra workflow.

6. **Keyless access with graceful 429 error messages** — the 429 response body contains natural-language instructions for the agent to upgrade. Unique UX pattern.
