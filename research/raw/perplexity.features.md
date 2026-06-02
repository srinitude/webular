# Perplexity API — Web Feature Catalog for Webular

**Coverage:** 153 total URLs in inventory · 30 pages deep-read (all 30 pre-selected pages; sonar-deep-research page was oversized and read at the model/title level only).

---

## URL Inventory — Capability Buckets

| Bucket | Count | Representative URLs |
|--------|-------|---------------------|
| **answer-summarize** (Sonar chat completions) | ~18 | /api-reference/sonar-post, /docs/sonar/*, /docs/sonar/models/* |
| **search** (raw ranked web results) | ~12 | /api-reference/search-post, /docs/search/*, /docs/search/filters/* |
| **agent/orchestration** (multi-tool loops) | ~14 | /api-reference/agent-post, /docs/agent-api/* |
| **extract** (fetch-url-content tool, file/doc parsing) | ~6 | /docs/agent-api/tools/fetch-url-content, /docs/sonar/media |
| **embeddings** | ~5 | /docs/embeddings/*, /api-reference/embeddings-post, /api-reference/contextualized-embeddings-post |
| **media** (image send/receive, video receive) | ~3 | /docs/sonar/media, /docs/agent-api/image-attachments |
| **async/polling** (long-running deep research) | ~3 | /api-reference/async-sonar-post, /api-reference/async-sonar-api-request-get, /api-reference/async-sonar-get |
| **finance-search** (structured market data) | ~2 | /docs/agent-api/tools/finance-search |
| **people-search** | ~2 | /docs/agent-api/tools/people-search, /docs/search/filters/people-search |
| **sdk/tooling** | ~8 | /docs/sdk/*, /docs/sonar/openai-compatibility, /docs/agent-api/openai-compatibility |
| **cookbook/examples** | ~40 | /docs/cookbook/*, /docs/cookbook/showcase/* |
| **admin/meta** | ~10 | /docs/admin/*, /docs/resources/*, /docs/getting-started/* |
| **integrations** | ~18 | /docs/getting-started/integrations/* (mastra, langchain, vercel-ai-sdk, litellm, etc.) |
| **other** (robots.txt, sitemap, llms.txt) | ~3 | /robots.txt, /sitemap.xml, /llms.txt |

---

## Feature Catalog

### 1. Sonar Chat Completion (POST /v1/sonar)
**Category:** answer-summarize
**Purpose:** OpenAI-compatible chat endpoint that performs a live web search before generating an answer. Returns a prose response with citations and optional search result metadata.

**Key Parameters:**
- `model` — `sonar` | `sonar-pro` | `sonar-deep-research` | `sonar-reasoning-pro`
- `messages[]` — `role`, `content` (text, image_url, file_url objects)
- `stream` — boolean; enables SSE streaming
- `stream_mode` — `"full"` (default) | `"concise"` (bandwidth-optimized with separate chunk types)
- `max_tokens` (0–128000)
- `temperature` (0–2), `top_p` (0–1)
- `response_format` — `{ type: "json_schema", json_schema: { schema: {...} } }` for structured output
- `search_mode` — `"web"` | `"academic"` | `"sec"`
- `return_images` — boolean; include image results
- `return_related_questions` — boolean
- `enable_search_classifier` — boolean; let AI decide when to search
- `disable_search` — boolean; pure LLM with no web search
- `search_domain_filter` — string[] max 20; allowlist (no prefix) or denylist (`-` prefix)
- `search_language_filter` — ISO 639-1 codes[] max 10
- `search_recency_filter` — `"hour"` | `"day"` | `"week"` | `"month"` | `"year"`
- `search_after_date_filter` / `search_before_date_filter` — MM/DD/YYYY
- `last_updated_after_filter` / `last_updated_before_filter` — MM/DD/YYYY
- `image_format_filter` — string[] (e.g., `["png","jpeg"]`)
- `image_domain_filter` — string[] max 10
- `web_search_options.user_location` — `{ country, region, city, latitude, longitude }`
- `web_search_options.search_context_size` — `"low"` | `"medium"` | `"high"`
- `web_search_options.search_type` — `"fast"` | `"pro"` | `"auto"` (Pro Search)
- `reasoning_effort` — `"minimal"` | `"low"` | `"medium"` | `"high"` (for reasoning models)
- `language_preference` — ISO 639-1 response language
- `media_response.overrides.return_videos` — boolean

**Response fields:** `choices[].message.content`, `citations[]`, `search_results[]` (title/url/date/last_updated/snippet/source), `images[]`, `related_questions[]`, `usage` (with cost breakdown, citation_tokens, num_search_queries, reasoning_tokens)

**FOSS Alternatives (no paid API):**
- Web search: `duckduckgo-search` (npm/pypi), SearXNG self-hosted, `brave-search` free tier, Bing Web Search free tier
- Web scrape + LLM answer: `playwright`/`puppeteer` (npm) + `@mozilla/readability` + local LLM (Ollama)
- Academic search: Semantic Scholar API (free), OpenAlex API (free)
- SEC filings: SEC EDGAR full-text search API (free)

---

### 2. Pro Search (search_type: "pro" on Sonar Pro)
**Category:** answer-summarize / agent
**Purpose:** Multi-step tool-using search mode on top of `sonar-pro`. The model automatically calls `web_search` and `fetch_url_content` tools in a research loop before synthesizing an answer. Only works with `stream: true`.

**Key Parameters:**
- `web_search_options.search_type` — `"pro"` | `"fast"` | `"auto"`
- `stream_mode` — `"concise"` provides separate `chat.reasoning` / `chat.reasoning.done` / `chat.completion.chunk` / `chat.completion.done` SSE chunk types with `reasoning_steps[]` visible

**Chunk types in concise mode:**
- `chat.reasoning` — live reasoning steps (thought + type + web_search/fetch results)
- `chat.reasoning.done` — all search_results + images + partial usage
- `chat.completion.chunk` — content delta
- `chat.completion.done` — final aggregated message, final search_results, usage.cost

**FOSS Alternatives:**
- `crawlee` (npm) BFS crawler + LLM loop with tool calling
- `langchain` agent with DuckDuckGo search tool + browser tool
- Build manually: SearXNG → fetch relevant URLs → Playwright content extract → local LLM

---

### 3. Async Sonar (POST /v1/async/sonar + GET /v1/async/sonar/{id})
**Category:** async/polling
**Purpose:** Submit a Sonar completion request that runs asynchronously (designed for `sonar-deep-research` which can take minutes). Returns a job ID immediately; poll to retrieve the result.

**Key Parameters (POST):**
- `request` — full `ApiChatCompletionsRequest` object (same params as sync Sonar)
- `idempotency_key` — string | null; prevents duplicate submissions

**Response status lifecycle:** `CREATED` → `IN_PROGRESS` → `COMPLETED` / `FAILED`
**Response (GET):** same as sync Sonar response wrapped in `{ id, model, created_at, started_at, completed_at, failed_at, error_message, response: {...} }`

**FOSS Alternatives:**
- Any job-queue pattern: `bull`/`bullmq` (npm), `celery` (Python) + a local LLM endpoint
- `p-queue` (npm) for rate-limited async fetch batches

---

### 4. Search API (POST /search)
**Category:** search
**Purpose:** Pure ranked web search returning a structured `results[]` array (no LLM synthesis). Returns `title`, `url`, `snippet`, `date`, `last_updated`. Different endpoint from Sonar; no chat/prose output.

**Key Parameters:**
- `query` — string or string[] (up to 5 for multi-query)
- `country` — ISO 3166-1 alpha-2
- `max_results` — 1–20, default 10
- `snippet_mode` — `"low"` | `"medium"` | `"high"` (default)
- `max_tokens` — total content budget 1–1,000,000
- `max_tokens_per_page` — per-result content cap 1–1,000,000
- `search_language_filter` — ISO 639-1 codes[] max 20
- `search_domain_filter` — string[] max 20 (allowlist or `-` denylist)
- `last_updated_after_filter` / `last_updated_before_filter` — MM/DD/YYYY
- `search_after_date_filter` / `search_before_date_filter` — MM/DD/YYYY
- `search_recency_filter` — `"hour"` | `"day"` | `"week"` | `"month"` | `"year"`

**Response:** `{ results: [{ title, url, snippet, date, last_updated }], id, server_time }`

**FOSS Alternatives:**
- `duckduckgo-search` (npm `duck-duck-scrape`, pypi `duckduckgo-search`)
- SearXNG REST API (self-host)
- Brave Search API (free tier: 2000 queries/month)
- Google Custom Search JSON API (free tier: 100/day)
- Bing Web Search API (free tier)
- `yacy` (self-hosted search engine)

---

### 5. Agent API (POST /v1/agent)
**Category:** agent/orchestration
**Purpose:** OpenAI Responses-API-compatible multi-provider endpoint. Routes to any model (OpenAI, Anthropic, Google, xAI, etc.) through one unified API, optionally with web search and URL fetch tools. Supports presets, model fallback chains, structured outputs, and streaming.

**Key Parameters:**
- `input` — string | message[] | function call objects
- `model` — `"provider/model"` format e.g. `"openai/gpt-5.5"`, `"anthropic/claude-sonnet-4-6"`, `"perplexity/sonar"`
- `models` — string[] max 5; fallback chain tried in order
- `preset` — `"fast-search"` | `"pro-search"` | `"deep-research"` (bundles model + tools + system prompt)
- `instructions` — system prompt (persists across tool call loop)
- `tools[]` — array of tool objects: `web_search`, `finance_search`, `people_search`, `fetch_url`, `FunctionTool`
- `max_steps` — 1–10; maximum research loop iterations
- `max_output_tokens` — integer
- `stream` — boolean; SSE with event types: `response.output_text.delta`, `response.output_text.done`, `response.reasoning.search_results`, `response.completed`
- `response_format` — `{ type: "json_schema", json_schema: { name, schema } }`
- `reasoning` — `ReasoningConfig` object
- `language_preference` — ISO 639-1

**Response output items (array):**
- `MessageOutputItem` (type: `"message"`) — content[].text, content[].annotations[]
- `SearchResultsOutputItem` (type: `"search_results"`) — queries[], results[]
- `FetchUrlResultsOutputItem` (type: `"fetch_url_results"`) — contents[]
- `FinanceResultsOutputItem` (type: `"finance_results"`)
- `PeopleSearchResultsOutputItem` (type: `"people_search_results"`)
- `FunctionCallOutputItem` (type: `"function_call"`)

**FOSS Alternatives:**
- LiteLLM (unified multi-provider, open source)
- LangChain / LangGraph agents
- Mastra (open source agent framework with tool calling)
- OpenRouter (multi-provider, has free tier)

---

### 6. Agent API — Web Search Tool
**Category:** search / agent
**Purpose:** Tool available within Agent API requests that lets any third-party model search the web. Returns `search_results` output item with queries and ranked results.

**Key Parameters (within tools array):**
- `type` — `"web_search"`
- `search_context_size` — `"low"` (300 tok) | `"medium"` (1000 tok) | `"high"` (4000 tok)
- `max_tokens` — exact budget override
- `max_tokens_per_page` — per-result content cap
- `filters.search_domain_filter` — string[] max 20
- `filters.search_recency_filter` — `"hour"` | `"day"` | `"week"` | `"month"` | `"year"`
- `filters.search_after_date_filter` / `filters.search_before_date_filter` — MM/DD/YYYY
- `filters.last_updated_after_filter` / `filters.last_updated_before_filter` — MM/DD/YYYY
- `user_location` — `{ country, region, city, latitude, longitude }`

**Pricing:** $5 per 1,000 invocations (separate from model tokens)

**FOSS Alternatives:** same as Search API row above

---

### 7. Agent API — Fetch URL Content Tool
**Category:** extract / scrape
**Purpose:** Tool within Agent API that fetches and extracts text content from specific known URLs. Best-effort; does not bypass paywalls. Up to 10 URLs per invocation.

**Key Parameters:**
- `type` — `"fetch_url"`
- `max_urls` — 1–10

**Response:** `fetch_url_results` output item with `contents[]` (url, title, snippet)

**Pricing:** $0.50 per 1,000 invocations

**FOSS Alternatives:**
- `playwright` / `puppeteer` (npm) — browser-based fetch with JS rendering
- `crawlee` (npm) — managed fetch + browser pool
- `@mozilla/readability` (npm) — extract main content from HTML
- `turndown` (npm) — HTML-to-Markdown conversion
- `node-fetch` + `cheerio` (npm) — lightweight HTML parse
- Python: `httpx` + `beautifulsoup4` + `html2text` or `markdownify`
- `trafilatura` (pypi) — readability/boilerplate removal
- Bun: `Bun.fetch()` + `HTMLRewriter` — streaming HTML transformation
- `r.jina.ai/{url}` — Jina AI free reader endpoint (not FOSS but free tier)

---

### 8. Agent API — Finance Search Tool
**Category:** search / extract
**Purpose:** Tool within Agent API to retrieve structured financial and market data (stock prices, P/E ratios, company financials).

**Key Parameters:**
- `type` — `"finance_search"`

**FOSS Alternatives:**
- `yfinance` (pypi) — Yahoo Finance scraper
- Alpha Vantage API (free tier)
- `financejs`/`yahoo-finance2` (npm)
- Polygon.io free tier
- Open source: `openbb-platform` (pypi)

---

### 9. Agent API — People Search Tool
**Category:** search
**Purpose:** Tool within Agent API to search for professionals, employees, and people data.

**Key Parameters:**
- `type` — `"people_search"`

**FOSS Alternatives:**
- LinkedIn public profile scraping (ToS gray area)
- Hunter.io free tier
- Clearbit free tier

---

### 10. Agent API — Function Tool (Custom Tools)
**Category:** agent
**Purpose:** Define custom function tools for the model to call; model emits a `function_call` output item, your code executes the function and passes back a `FunctionCallOutputInput`.

**Key Parameters:**
- `type` — `"function"`
- `name`, `description`, `parameters` (JSON Schema)

**FOSS Alternatives:** Any LLM with tool-calling (Ollama + Llama 3.1/3.3, Claude, GPT-4o via direct API)

---

### 11. Streaming (SSE)
**Category:** answer-summarize / agent
**Purpose:** Server-sent events for real-time progressive output. Two modes for Sonar; SSE event-typed stream for Agent API.

**Sonar stream events:** delta chunks → search_results in final chunk(s)
**Sonar concise mode chunk types:** `chat.reasoning` | `chat.reasoning.done` | `chat.completion.chunk` | `chat.completion.done`

**Agent API stream event types:**
- `response.output_text.delta` — incremental text
- `response.output_text.done` — text complete
- `response.reasoning.search_results` — search results (arrive before text)
- `response.completed` — full response object with usage

**FOSS Alternatives:**
- Any streaming HTTP endpoint; `eventsource-parser` (npm), `sseclient` (pypi)
- `ai` SDK (Vercel) for client-side streaming UI with FOSS models

---

### 12. Structured Output / JSON Schema
**Category:** answer-summarize / agent
**Purpose:** Force the model to return a response conforming to a provided JSON Schema. Works on both Sonar API and Agent API.

**Key Parameters:**
- `response_format.type` — `"json_schema"`
- `response_format.json_schema.schema` — JSON Schema object
- `response_format.json_schema.name` — 1–64 alphanumeric (required on Agent API)

**Note:** First request with a new schema may incur 10–30s warm-up delay.

**FOSS Alternatives:**
- `zod` + `zodResponseFormat` (OpenAI SDK, npm)
- `instructor` (pypi) — structured outputs for any LLM
- `outlines` (pypi) — guided generation with JSON Schema
- `jsonformer` (pypi)

---

### 13. Search Domain Filter
**Category:** search / filter
**Purpose:** Restrict or exclude specific domains from search results. Works on Search API, Sonar API, and Agent API web_search tool.

**Modes:**
- Allowlist: `["nature.com", "arxiv.org"]` — only these domains
- Denylist: `["-reddit.com", "-pinterest.com"]` — exclude these
- TLD filter: `[".gov"]`, `[".edu"]` — all sites of that TLD
- Up to 20 domains per request; no mixing modes

**FOSS Alternatives:**
- `duckduckgo-search` site: operator
- SearXNG engine-specific domain filters
- Post-filter results in application code

---

### 14. Date & Recency Filters
**Category:** search / filter
**Purpose:** Restrict search results to a time window by original publish date, last updated date, or relative recency period.

**Parameters:**
- `search_after_date_filter` / `search_before_date_filter` — MM/DD/YYYY (publication date)
- `last_updated_after_filter` / `last_updated_before_filter` — MM/DD/YYYY (update date)
- `search_recency_filter` — `"hour"` | `"day"` | `"week"` | `"month"` | `"year"` (relative)
- `search_recency_filter` cannot be combined with explicit date filters

**FOSS Alternatives:**
- `duckduckgo-search` `dateRestrict` param
- SearXNG `time_range` filter
- Post-filter in application code on `result.date`

---

### 15. Language Filter
**Category:** search / filter
**Purpose:** Return only results in specified languages. ISO 639-1 codes, max 10.

**Parameter:** `search_language_filter` — e.g. `["en", "fr", "de"]`

**FOSS Alternatives:**
- SearXNG `language` param
- `langdetect` (pypi) / `franc` (npm) post-filter

---

### 16. Location / Geo Filter
**Category:** search / filter
**Purpose:** Personalize search by user geographic location for local-aware results.

**Parameters:**
- `web_search_options.user_location` — `{ country, region, city, latitude, longitude }`
- `country` (ISO 3166-1 alpha-2) required if coordinates provided

**FOSS Alternatives:**
- DuckDuckGo `kl` region parameter
- SearXNG language/region combination

---

### 17. Academic Search Mode
**Category:** search / filter
**Purpose:** Target scholarly/peer-reviewed sources by setting `search_mode: "academic"`. Date filters silently ignored in academic mode.

**FOSS Alternatives:**
- Semantic Scholar API (free, no key required for basic)
- OpenAlex API (fully free and open)
- `scholarly` (pypi) — Google Scholar scraper
- arXiv API (free)
- PubMed E-utilities API (free)
- CORE API (open access research papers, free tier)

---

### 18. SEC Filings Search Mode
**Category:** search / extract
**Purpose:** Target U.S. SEC EDGAR filings by setting `search_mode: "sec"`. Can be combined with date filters.

**FOSS Alternatives:**
- SEC EDGAR Full-Text Search API (free, no key)
- `edgar` (npm) / `python-edgar` (pypi) — direct EDGAR scraping
- `sec-api.io` free tier

---

### 19. Search Context Size Control
**Category:** search / filter
**Purpose:** Control how much web content is retrieved per search to balance cost and comprehensiveness.

**Parameters:**
- `web_search_options.search_context_size` — `"low"` | `"medium"` | `"high"`
- `max_tokens` / `max_tokens_per_page` on Search API and web_search tool

---

### 20. Search Classifier (Auto / Enable)
**Category:** search / filter
**Purpose:** Let the model automatically decide whether web search is needed (Sonar: `enable_search_classifier`), or route to Pro Search vs Fast Search automatically (Agent/Pro Search: `search_type: "auto"`). Transparent in response metadata (`search_metadata.search_type_used`).

**FOSS Alternatives:** Implement a small classifier or keyword heuristic to route queries; use `disable_search: true` for pure LLM queries.

---

### 21. Image Input (Multimodal)
**Category:** media
**Purpose:** Send images to Sonar models for vision analysis. Supports base64 or HTTPS URL.

**Parameters:**
- `messages[].content[].type` — `"image_url"`
- `messages[].content[].image_url.url` — data URI (`data:image/png;base64,...`) or HTTPS URL
- Supported formats: PNG, JPEG, WEBP, GIF; max 50 MB
- Token pricing: `(width × height) / 750` input tokens

**FOSS Alternatives:**
- `playwright` screenshot → base64
- `sharp` (npm) image processing
- Any open vision model: LLaVA, Qwen-VL (via Ollama)

---

### 22. File/Document Input
**Category:** extract / media
**Purpose:** Send PDF, DOC, DOCX, TXT, RTF files to Sonar for analysis/summarization. Attach via `file_url` content type with public URL or base64.

**Parameters:**
- `messages[].content[].type` — `"file_url"`
- `messages[].content[].file_url.url` — public HTTPS URL or base64 string (no prefix)
- Max 50 MB per file; max 30 files per request

**FOSS Alternatives:**
- `pdf-parse` (npm) / `pdfplumber` (pypi) — PDF text extraction
- `mammoth` (npm) — DOCX to HTML/Markdown
- `unstructured` (pypi) — multi-format document extraction
- `markitdown` (pypi, Microsoft) — DOCX/PDF to Markdown

---

### 23. Image Return (Receive Images)
**Category:** media
**Purpose:** Have Sonar include image results in its response, optionally filtered by domain or format.

**Parameters:**
- `return_images` — boolean
- `image_domain_filter` — string[] max 10 (allowlist or `-` denylist)
- `image_format_filter` — string[] (e.g. `["gif","jpeg","png","webp"]`) max 10
- Max 30 images per response

**FOSS Alternatives:**
- DuckDuckGo Images API (unofficial)
- Brave Images Search (free tier)
- Unsplash API (free tier)

---

### 24. Video Return (Receive Videos)
**Category:** media
**Purpose:** Include video results (URL, thumbnail_url, metadata) in Sonar API responses.

**Parameters:**
- `media_response.overrides.return_videos` — boolean

**FOSS Alternatives:**
- YouTube Data API (free tier: 10,000 units/day)
- Invidious API (self-hosted YouTube frontend, free)

---

### 25. Async Chat Completion (Deep Research)
**Category:** async / research
**Purpose:** Submit long-running Sonar requests (especially `sonar-deep-research`) asynchronously and poll for completion. Sonar Deep Research conducts exhaustive multi-step searches and generates comprehensive reports.

**Sonar Deep Research model characteristics:**
- Expert-level research for comprehensive reports, market analyses, literature reviews
- Executes many sequential and parallel search queries internally
- Produces long-form synthesized reports with citations
- Takes minutes to complete (hence async API)

**FOSS Alternatives:**
- Build a research loop: SearXNG → `crawlee` fetch → chunk + embed → `pgvector`/`chromadb` → local LLM synthesis
- `storm` (pypi, Stanford) — automated research and outline generation
- `gpt-researcher` (pypi) — open source deep research agent

---

### 26. Related Questions
**Category:** answer-summarize
**Purpose:** Return AI-generated follow-up query suggestions based on search results and the current question.

**Parameter:** `return_related_questions` — boolean

**FOSS Alternatives:**
- Generate follow-ups with a local LLM post-completion
- `People Also Ask` scraping from SerpAPI free tier

---

### 27. Sonar Reasoning Pro (Chain-of-Thought)
**Category:** answer-summarize / reasoning
**Purpose:** Multi-step Chain-of-Thought reasoning model with web search grounding. Outputs a `<think>` section with reasoning tokens before the final answer. Use `reasoning_effort` to control depth.

**Parameters:**
- `model` — `"sonar-reasoning-pro"`
- `reasoning_effort` — `"minimal"` | `"low"` | `"medium"` | `"high"`
- Context: 128K tokens

**FOSS Alternatives:**
- DeepSeek-R1 via Ollama (reasoning model, open weights)
- Qwen QwQ via Ollama

---

### 28. Multi-Query Search
**Category:** search
**Purpose:** Pass up to 5 search queries in a single Search API request; results are grouped per query.

**Parameter:** `query` — string[] (up to 5 elements)

**FOSS Alternatives:**
- `Promise.all()` (JS) / `asyncio.gather()` (Python) with multiple separate search calls
- `p-limit` (npm) for rate-limited parallel fetching

---

### 29. Agent API Presets
**Category:** agent
**Purpose:** Named, curated configurations that bundle a model, system prompt, tools, and search parameters. Perplexity updates preset internals as evals improve; calling by name auto-adopts improvements.

**Available Presets:**
- `"fast-search"` — quick citation-rich answers, optimized for speed
- `"pro-search"` — multi-step research with `web_search` + `fetch_url` tools
- `"deep-research"` — exhaustive research, long-running

**FOSS Alternatives:**
- Store equivalent configs as plain objects in code; version and A/B test manually

---

### 30. Model Fallback Chain
**Category:** agent
**Purpose:** Specify up to 5 models; the API tries them in order, falling back if one fails. Response `model` field reflects which model succeeded.

**Parameter:** `models` — string[] 1–5 (takes precedence over `model`)

**FOSS Alternatives:**
- `litellm` fallback/retry logic
- Application-level try/catch with ordered model list

---

### 31. OpenAI SDK Compatibility (Sonar)
**Category:** sdk / integration
**Purpose:** Use existing OpenAI Python/TypeScript SDKs with Sonar API by pointing `base_url` to `https://api.perplexity.ai`. `/chat/completions` accepted as alias for `/v1/sonar`.

**Configuration:**
```python
from openai import OpenAI
client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")
```
Use `extra_body` (Python) to pass Perplexity-specific params.

**FOSS Alternatives:** LiteLLM provides the same multi-provider OpenAI-compatible abstraction.

---

### 32. OpenAI Responses-API Compatibility (Agent API)
**Category:** sdk / integration
**Purpose:** Agent API endpoint `/v1/agent` also accepts requests at `/v1/responses` for drop-in compatibility with OpenAI's Responses API format.

---

### 33. Perplexity Native SDK
**Category:** sdk
**Purpose:** Official Python (`perplexityai` on PyPI) and TypeScript (`@perplexity-ai/perplexity_ai` on npm) SDKs. Provide type-safe access to all four APIs: Agent, Search, Sonar, Embeddings.

**SDK convenience methods:**
- Python: `client.chat.completions.create()` (Sonar), `client.search.create()` (Search), `client.responses.create()` (Agent), `client.embeddings.create()`
- TypeScript: same structure
- `response.output_text` — convenience aggregator for Agent API output

---

### 34. Embeddings API (Standard)
**Category:** embeddings
**Purpose:** Generate dense text embeddings for semantic search, clustering, RAG.

**Endpoint:** POST `/embeddings`

**FOSS Alternatives:**
- `sentence-transformers` (pypi) — state-of-the-art open embeddings (all-MiniLM, all-mpnet, BGE, etc.)
- `@xenova/transformers` (npm) — in-browser/Node embedding
- Ollama embedding models (`nomic-embed-text`, `mxbai-embed-large`)
- `fastembed` (pypi) — ONNX-based fast embeddings

---

### 35. Contextualized Embeddings API
**Category:** embeddings
**Purpose:** Generate embeddings that incorporate additional context beyond the text itself.

**Endpoint:** POST `/contextualized-embeddings`

**FOSS Alternatives:**
- `sentence-transformers` with cross-encoder models
- `llm-embeddings` with system-prompt context injection

---

### 36. Streaming Citation Parsing Pattern
**Category:** answer-summarize / cookbook
**Purpose:** Parse streaming Agent API responses to extract `[N]` citation markers as text arrives, map them to `search_results[].id`, validate URLs, and build a formatted cited output.

**Key patterns documented:**
- `response.reasoning.search_results` events arrive before text deltas
- `search_results[].id` maps to `[N]` in text
- `fast-search` preset uses `[1]`, `pro-search` uses `[web:1]`
- Never ask the model to generate URLs; always use `search_results` field

**FOSS Alternatives:**
- Build regex `\[(\d+)\]` extractor + any open search API
- `aiohttp` async URL validation

---

### 37. Domain Filter Presets Pattern (Cookbook)
**Category:** search / filter / cookbook
**Purpose:** Named reusable domain filter configurations (news, academic, government, tech, no_social, no_seo_spam) that can be applied per-request.

**Patterns demonstrated:**
- `".gov"`, `".edu"`, `".gov.uk"` TLD allowlists
- Combined `search_domain_filter` + `search_recency_filter`
- Competitor exclusion via denylist

---

### 38. Image Attachments (Agent API)
**Category:** media / agent
**Purpose:** Send images to Agent API for vision analysis using multi-turn conversation with third-party vision models.

**Endpoint:** POST /v1/agent with image content items

**FOSS Alternatives:** Same as Image Input (Sonar) above.

---

## Unique Capabilities vs FOSS Baseline

1. **Integrated real-time web-grounded LLM** — Sonar answers combine live search + generation in one API call; FOSS requires manual pipeline (search → fetch → LLM)
2. **Pro Search multi-step tool loop with streaming reasoning visibility** — reasoning steps with search queries visible in SSE stream; difficult to replicate without custom agent loop code
3. **Sonar Deep Research async** — exhaustive multi-source research report generation with polling; FOSS equivalent (`storm`, `gpt-researcher`) exists but requires self-hosting infrastructure
4. **SEC Filings search mode** — EDGAR search natively integrated; FOSS alternative exists (EDGAR API) but not integrated with LLM
5. **Multi-provider model gateway with transparent pricing** — single API for OpenAI/Anthropic/Google/xAI models with exact cost breakdown; FOSS equivalent is LiteLLM
6. **People Search tool** — professional/employee search integrated as a first-party tool
7. **Video return in search responses** — returning video metadata from a search; no direct FOSS equivalent

---

## Coverage Summary

- **Total URLs in inventory:** 153
- **Deep-read count:** 30 (all pre-selected pages; sonar-deep-research skipped due to size, covered by title/model-level data)
- **Capability buckets covered:** 14 distinct buckets categorized from path analysis
