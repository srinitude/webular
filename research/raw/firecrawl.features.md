# Firecrawl Feature Catalog
**Product:** Firecrawl — Web Data API for AI  
**Doc root:** https://docs.firecrawl.dev  
**Cataloged:** 2026-06-02  
**URL inventory:** 1182 total URLs (see firecrawl.urls.json)  
**Deep-read pages:** 30 (all 30 pre-selected feature + API pages read; 0 errors)

---

## URL Categorization (from path + title analysis of all 1182 URLs)

| Bucket | Count (approx) | Representative paths |
|---|---|---|
| **scrape** | ~220 | `/features/scrape`, `/api-reference/endpoint/scrape`, `/features/fast-scraping`, `/features/enhanced-mode`, `/features/lockdown`, `/features/change-tracking`, `/features/llm-extract`, `/features/document-parsing` (+ i18n duplicates) |
| **crawl** | ~120 | `/features/crawl`, `/api-reference/endpoint/crawl-*`, `/api-reference/v1-endpoint/crawl-*` |
| **map** | ~90 | `/features/map`, `/api-reference/endpoint/map`, `/api-reference/v1-endpoint/map` |
| **extract** | ~100 | `/features/extract`, `/api-reference/v1-endpoint/extract*`, `/api-reference/endpoint/extract*`, `/developer-guides/usage-guides/choosing-the-data-extractor` |
| **search** | ~70 | `/features/search`, `/api-reference/endpoint/search`, `/api-reference/v1-endpoint/search` |
| **answer-summarize** | ~20 | `/features/ask`, `/api-reference/endpoint/ask`, `/api-reference/endpoint/docs-search` |
| **research (agent)** | ~60 | `/features/agent`, `/agents/fire-1-extract`, `/agents/fire-1`, `/features/models`, `/api-reference/endpoint/agent*` |
| **parse** | ~60 | `/features/parse`, `/features/document-parsing`, `/api-reference/endpoint/parse` |
| **proxy** | ~30 | `/features/proxies`, `/features/enhanced-mode`, `/features/lockdown` |
| **monitor** | ~100 | `/features/monitoring`, `/features/change-tracking`, `/api-reference/endpoint/monitor-*`, `/api-reference/endpoint/webhook-monitor-*` |
| **interact (browser automation)** | ~60 | `/features/interact`, `/api-reference/endpoint/scrape-execute`, `/api-reference/endpoint/browser-*` |
| **batch** | ~70 | `/features/batch-scrape`, `/api-reference/v1-endpoint/batch-scrape*`, `/api-reference/endpoint/batch-scrape*` |
| **webhooks** | ~30 | `/webhooks/overview`, `/webhooks/security`, `/webhooks/events`, `/api-reference/endpoint/webhook-*` |
| **SDKs / quickstarts** | ~250 | `/sdks/*`, `/quickstarts/*` (Python, Node, Go, Rust, Java, .NET, Ruby, PHP, Elixir + frameworks) |
| **integrations / LLM frameworks** | ~80 | `/integrations/*`, `/developer-guides/llm-sdks-and-frameworks/*`, `/developer-guides/workflow-automation/*` |
| **other (billing, rate-limits, contributing, use-cases, i18n)** | ~92 | `/billing`, `/rate-limits`, `/contributing/*`, `/use-cases/*` |

---

## Feature Catalog

### 1. Single-Page Scrape (`/v2/scrape`)

**Category:** scrape  
**Purpose:** Fetch any web URL and return clean, structured content in multiple formats. Handles JS-rendered pages, PDFs, dynamic content, proxies, caching, and rate limits automatically.  

**Key Parameters:**
- `url` (required) — target URL
- `formats` — array of string formats or format objects: `markdown`, `html`, `rawHtml`, `links`, `images`, `summary`, `branding`, `audio`, `video`, `screenshot`, `json` (with `schema`/`prompt`), `changeTracking` (with `modes`, `tag`, `schema`), `attributes` (with `selectors`), `query` (with `prompt`, `mode`)
- `onlyMainContent` (bool, default true) — strip nav/footer boilerplate
- `includeTags` / `excludeTags` — CSS selectors to include/exclude
- `waitFor` (ms) — explicit JS wait before scrape
- `maxAge` (ms, default 172800000 = 2d) — serve from cache if fresher; `0` = always fresh
- `storeInCache` (bool) — opt out of caching
- `timeout` (ms, default 60000)
- `mobile` (bool) — emulate mobile viewport
- `location` — `{ country: ISO-3166-1-alpha2, languages: string[] }`
- `proxy` — `"basic"` | `"enhanced"` | `"auto"`
- `actions` — array of browser actions (see Browser Actions section)
- `parsers` — `[{ type: "pdf", mode: "fast"|"auto"|"ocr", maxPages: int }]`
- `profile` — `{ name: string, saveChanges: bool }` — persistent browser session
- `lockdown` (bool) — cache-only mode, no outbound request
- `zeroDataRetention` (bool) — ZDR: no persistent storage of content
- `redactPII` (bool) — scrub PII from response
- `removeBase64Images` (bool)
- `skipTlsVerification` (bool)
- `screenshotOptions` — `{ fullPage, quality, viewport: { width, height } }`

**Output formats detail:**
- `markdown` — clean Markdown (default)
- `html` — cleaned HTML
- `rawHtml` — unmodified HTML from server
- `links` — all hyperlinks on page
- `images` — all image URLs
- `summary` — LLM-generated page summary
- `branding` — full brand identity profile (colors, fonts, typography, spacing, components, icons, animations, layout, personality)
- `json` — LLM-structured extraction: `{ type: "json", schema?: object, prompt?: string }`
- `screenshot` — URL to screenshot PNG (expires 24h): `{ type: "screenshot", fullPage?, quality?, viewport? }`
- `audio` — signed GCS MP3 URL from video pages (e.g. YouTube), expires 1h
- `video` — signed GCS video URL from video pages, expires 1h
- `query` — natural-language Q&A about page: `{ type: "query", prompt, mode: "directQuote"|"freeform" }` → `answer` field
- `highlights` — source-text selection from page: `{ type: "highlights", query }` → `highlights` field
- `changeTracking` — diff vs previous scrape: `{ type: "changeTracking", modes: ["git-diff","json"], tag?, schema?, prompt? }`
- `attributes` — HTML attribute extraction via CSS selectors

**Metadata returned:** title, description, language, ogTitle/Description/Image/Url/SiteName, robots, keywords, statusCode, contentType, scrapeId, cacheState, cachedAt, proxyUsed

**FOSS alternatives:**
- Fetching/rendering: `playwright` (npm), `puppeteer` (npm), `crawlee` (npm), `playwright-python` (pypi)
- HTML → Markdown: `turndown` (npm), `html-to-text` (npm), `markdownify` (pypi)
- Content extraction: `@mozilla/readability` (npm), `readability-lxml` (pypi), `trafilatura` (pypi)
- Screenshot: `playwright` (headless screenshot API)
- PDF parsing: `pdf-parse` (npm), `pdfjs-dist` (npm), `pypdf` (pypi), `pdfminer.six` (pypi)
- Audio extraction: `yt-dlp` (pypi/standalone) for YouTube audio
- JSON extraction (LLM): local LLM via `ollama`, `llama.cpp`; structured output via `outlines` (pypi), `instructor` (pypi)
- Branding: `color-thief` (npm), `culori` (npm) for color extraction

---

### 2. Recursive Crawl (`/v2/crawl`)

**Category:** crawl  
**Purpose:** Recursively discover and scrape every reachable subpage starting from a URL. Handles sitemap discovery, JS rendering, rate limits, and deduplication.

**Key Parameters:**
- `url` (required)
- `limit` (int, default 10000) — max pages to crawl
- `maxDiscoveryDepth` (int) — link-hop depth limit
- `includePaths` / `excludePaths` — regex patterns on pathname
- `regexOnFullURL` (bool) — match regex against full URL incl. query params
- `crawlEntireDomain` (bool) — follow sibling/parent paths
- `allowSubdomains` (bool)
- `allowExternalLinks` (bool)
- `sitemap` — `"include"` (default) | `"skip"` | `"only"`
- `ignoreQueryParameters` (bool)
- `ignoreRobotsTxt` (bool, enterprise only)
- `robotsUserAgent` (string, enterprise only)
- `delay` (seconds) — per-page delay; forces concurrency=1
- `maxConcurrency` (int)
- `scrapeOptions` (object) — all `/scrape` options applied per page
- `webhook` — `{ url, headers, metadata, events: ["started","page","completed","failed"] }`
- `prompt` (string) — natural language → crawl options (use `/crawl/params-preview` to preview)

**SDK methods:**
- `crawl()` — sync, returns all results with auto-pagination
- `startCrawl()` — async, returns job ID
- `getCrawlStatus(id)` — poll job
- `watcher(id, kind, ...)` — async generator for real-time WebSocket updates

**FOSS alternatives:**
- `crawlee` (npm) — full crawling framework with Playwright/Cheerio, BFS/DFS, robots.txt, sitemaps
- `scrapy` (pypi) — full Python crawling framework
- `simplecrawler` (npm) — lightweight BFS crawler
- `node-crawler` (npm) — Cheerio-based crawler
- `colly` (go module) — Go crawler
- `sitemapper` (npm) — sitemap.xml fetching and parsing
- `robots-parser` (npm), `reppy` (pypi) — robots.txt parsing

---

### 3. Site Mapping (`/v2/map`)

**Category:** map  
**Purpose:** Fast URL discovery for an entire website. Returns list of URLs (with title/description) sourced from sitemap, SERP, and cached crawl data. Does not scrape content.

**Key Parameters:**
- `url` (required)
- `search` (string) — filter returned URLs by text match (returns ranked by relevance)
- `limit` (int, default 100) — max URLs to return (up to 100,000; 1 credit flat)
- `sitemap` — `"include"` | `"skip"` | `"only"`
- `includeSubdomains` (bool, default true)
- `location` — `{ country, languages }`

**FOSS alternatives:**
- `sitemapper` (npm) — parse sitemap.xml trees
- `sitemap-parser` (npm)
- `python-sitemap` (pypi)
- Manual: BFS fetch with `cheerio` / `BeautifulSoup` link extraction
- `crawlee` link extraction mode

---

### 4. Structured Data Extraction — Multi-URL (`/v2/extract`)

**Category:** extract  
**Purpose:** LLM-powered structured data extraction from one or many URLs, including wildcard domain crawls (`example.com/*`). Async job-based. Deprecated in favor of `/agent`.

**Key Parameters:**
- `urls` (array) — supports wildcards like `example.com/*`
- `prompt` (string, optional if schema present)
- `schema` (JSON Schema object)
- `enableWebSearch` (bool) — follow links outside specified domain
- `agent` — `{ model: "FIRE-1" }` for agentic navigation

**SDK methods:**
- `extract(urls, prompt, schema)` — sync (waits for completion)
- `startExtract()` / `getExtractStatus(id)` — async pattern

**FOSS alternatives:**
- `unstructured` (pypi) — open-source document parsing + extraction
- `instructor` (pypi) — structured LLM output for OpenAI-compatible APIs
- `outlines` (pypi) — structured generation with local LLMs
- `marvin` (pypi) — AI-powered extraction
- `jina-ai/reader` (self-hostable) — URL → markdown → LLM extraction pipeline
- CSS selectors with `cheerio` / `BeautifulSoup` for deterministic extraction

---

### 5. Agentic Web Extraction (`/v2/agent`)

**Category:** research  
**Purpose:** Autonomous AI agent that searches and navigates the entire web to find and extract structured data. No URL required — just describe what you want. Successor to `/extract`.

**Key Parameters:**
- `prompt` (required, max 10000 chars) — natural language description of what to find
- `model` — `"spark-1-mini"` (default, 60% cheaper) | `"spark-1-pro"` (higher accuracy)
- `urls` (array, optional) — constrain agent to specific URLs
- `schema` (JSON Schema) — optional structured output schema (supports Pydantic/Zod in SDKs)
- `maxCredits` (int, default 2500) — credit budget cap; job fails but is not billed on failure

**SDK methods:**
- `agent(prompt, schema, model, maxCredits)` — sync
- `startAgent()` / `getAgentStatus(id)` — async pattern

**FOSS alternatives:**
- `langchain` + `SERP API` (any free-tier) + `playwright` + local LLM
- `autogen` / `crewai` with web-search + browser tools
- `open-interpreter` — code interpreter with web access
- Combination: `duckduckgo-search` (pypi, free) + `crawlee` + `instructor`

---

### 6. Web Search (`/v2/search`)

**Category:** search  
**Purpose:** Web search returning titles, descriptions, URLs, and optionally full scraped content per result. Supports web, news, and image result types with domain filtering and time-based filtering.

**Key Parameters:**
- `query` (required)
- `limit` (int, default 10) — per source type when multiple sources specified
- `sources` — array: `"web"` (default), `"news"`, `"images"`
- `categories` — `"github"`, `"research"` (arXiv/Nature/IEEE/PubMed), `"pdf"`
- `includeDomains` / `excludeDomains` — domain allow/blocklist
- `scrapeOptions` — full `/scrape` options applied to each result (formats, proxy, etc.)
- `location` — country/language for geo-targeted results
- `tbs` — time-based filter: `"qdr:h"`, `"qdr:d"`, `"qdr:w"`, `"qdr:m"`, `"qdr:y"`, `"sbd:1"`, or custom date range `"cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY"`
- `timeout` (ms)
- `enterprise` — ZDR options: `["zdr"]` (full, 10 credits/10 results) | `["anon"]` (anonymized, 2 credits/10 results)

**FOSS alternatives:**
- `duckduckgo-search` (pypi) — free DuckDuckGo search, no API key
- `searxng` — self-hostable meta-search engine (Docker image available)
- `googlesearch-python` (pypi) — unofficial Google scraping
- `brave-search` (free tier API, 2000 req/month)
- `exa-py` (pypi) — Exa search API (free tier available)
- `newspaper3k` / `newspaper4k` (pypi) — article extraction from search results
- `gnewsclient` (pypi) — Google News RSS

---

### 7. Batch Scrape (`/v2/batch/scrape`)

**Category:** scrape  
**Purpose:** Scrape a known list of URLs concurrently in a single job. Like `/scrape` applied to many URLs simultaneously. Supports all scrape options per-URL.

**Key Parameters:**
- `urls` (array, required)
- All `/scrape` options (`formats`, `proxy`, `onlyMainContent`, etc.)
- `maxConcurrency` (int) — cap concurrent browsers for this job
- `webhook` — real-time events: `batch_scrape.started`, `batch_scrape.page`, `batch_scrape.completed`, `batch_scrape.failed`

**SDK methods:**
- `batchScrape()` / `batch_scrape()` — sync
- `startBatchScrape()` / `start_batch_scrape()` — async
- `getBatchScrapeStatus(id)` / `get_batch_scrape_status(id)`

**FOSS alternatives:**
- `crawlee` with custom URL list mode
- `scrapy` with a `start_urls` spider
- `asyncio` + `httpx` + `playwright` for concurrent fetching
- `p-limit` (npm) + `playwright` — controlled concurrency

---

### 8. Browser Interaction (`/v2/scrape/{scrapeId}/interact`)

**Category:** scrape / interact  
**Purpose:** Stateful browser session tied to a prior scrape. Execute multi-step interactions on a page using natural language prompts, Playwright code (Node.js/Python), or Bash with agent-browser CLI. Supports persistent profiles (saved cookies/localStorage).

**Endpoints:**
- `POST /v2/scrape/{scrapeId}/interact` — execute prompt or code
- `DELETE /v2/scrape/{scrapeId}/interact` — stop session

**Key Parameters (interact):**
- `prompt` (string, max 10000 chars) — natural language task
- `code` (string, max 100000 chars) — Playwright Node.js/Python code or Bash
- `language` — `"node"` (default), `"python"`, `"bash"`
- `timeout` (seconds, 1–300, default 30)
- `origin` (string) — caller identifier for activity tracking

**Response fields:**
- `liveViewUrl` — embeddable iframe (read-only view)
- `interactiveLiveViewUrl` — embeddable iframe (user-controllable)
- `output` — agent's NL answer (prompt mode)
- `stdout`, `result`, `stderr`, `exitCode`, `killed`

**Profile params (on initial scrape):**
- `profile.name` — named persistent browser profile
- `profile.saveChanges` (bool) — persist state changes

**Browser Actions (for `/scrape` `actions` array, legacy):**
- `wait`, `click`, `write`, `press`, `scroll`, `screenshot`, `scrape`, `executeJavascript`, `pdf`

**FOSS alternatives:**
- `playwright` (npm / pypi) — full browser automation, Playwright Page API
- `puppeteer` (npm) — Chrome DevTools Protocol automation
- `agent-browser` (npm, from vercel-labs) — accessibility-tree CLI for LLM automation
- `selenium` (pypi/npm) — older browser automation
- `pyppeteer` (pypi) — Python Puppeteer port

---

### 9. Document Parsing — File Upload (`/v2/parse`)

**Category:** parse  
**Purpose:** Convert local or non-public documents (PDF, DOCX, XLSX, etc.) to Markdown/structured JSON. Up to 50 MB per request. Uses Rust-based engine for speed (5x faster claim). For public URLs, use `/scrape` instead (auto-detects document type).

**Supported formats:** `.html`, `.htm`, `.pdf`, `.docx`, `.doc`, `.odt`, `.rtf`, `.xlsx`, `.xls`

**Key Parameters (multipart/form-data):**
- `file` (binary, required)
- `options` JSON:
  - `formats` — `["markdown"]` (default), `"html"`, `"rawHtml"`, `"links"`, `"images"`, `"summary"`, `"json"` (with schema/prompt)
  - `onlyMainContent` (bool, default true)
  - `includeTags` / `excludeTags`
  - `timeout` (ms, default 30000, max 300000)
  - `parsers` — `[{ type: "pdf", mode: "fast"|"auto"|"ocr", maxPages: int }]`

**PDF modes:** `fast` (text only), `auto` (text + OCR fallback, default), `ocr` (force OCR all pages)

**FOSS alternatives:**
- PDF: `pdf-parse` (npm), `pdfjs-dist` (npm), `pypdf` (pypi), `pdfminer.six` (pypi), `pymupdf` (pypi), `ocrmypdf` (pypi for OCR)
- DOCX/ODT: `mammoth` (npm/pypi), `docx2txt` (pypi), `python-docx` (pypi)
- XLSX/XLS: `xlsx` (npm, SheetJS), `openpyxl` (pypi), `xlrd` (pypi)
- HTML: `@mozilla/readability` (npm), `trafilatura` (pypi)
- RTF: `rtf-stream-parser` (npm), `striprtf` (pypi)
- Unified: `unstructured` (pypi) — handles all formats + OCR

---

### 10. Change Tracking

**Category:** monitor  
**Purpose:** Compare current page content against the previous scrape snapshot. Detect new/changed/removed/same status. Available as a `format` on `/scrape`, `/crawl`, and `/batch/scrape`.

**Key Parameters (as format object):**
- `type: "changeTracking"`
- `modes` — `["git-diff"]` (line-level diff) | `["json"]` (field-level LLM diff) | `["git-diff","json"]` (both)
- `tag` (string) — separate tracking history per tag (e.g., "hourly", "daily")
- `schema` (JSON Schema) — for `json` mode, fields to track
- `prompt` (string) — guide LLM extraction for `json` mode

**Response fields:**
- `changeStatus` — `"new"` | `"same"` | `"changed"` | `"removed"`
- `previousScrapeAt` (ISO timestamp | null)
- `visibility` — `"visible"` | `"hidden"` (no longer linked)
- `diff.text` — unified diff string (git-diff mode)
- `diff.json` — parseDiff-style AST (git-diff mode)
- `json` — `{ fieldPath: { previous, current } }` dict (json mode)

**Billing:** No extra cost for basic + git-diff. JSON mode: 5 credits/page.

**FOSS alternatives:**
- `diff` (npm) — text diff
- `diff-match-patch` (npm/pypi) — Google diff library
- `deep-diff` (npm), `deepdiff` (pypi) — object-level diffing
- Custom: scrape + store in SQLite/Redis + compare on next scrape
- `distill.io` / `hexowatch` — commercial alternatives (not FOSS)
- `changedetection.io` — self-hostable open-source page monitoring

---

### 11. Scheduled Monitoring (`/v2/monitor/*`)

**Category:** monitor  
**Purpose:** Create recurring monitors that scrape/crawl on a schedule (cron or natural language), diff results, optionally judge meaningfulness with an LLM goal, and notify via webhook or email.

**Monitor types:**
- `scrape` target — one scrape per URL per check
- `crawl` target — full crawl per check, diff all discovered pages

**Key Parameters (create monitor):**
- `name` (string)
- `schedule` — `{ cron, timezone }` or `{ text: "every 30 minutes", timezone }` (min interval: 15min)
- `goal` (string) — plain-language description of what changes matter (enables LLM judging)
- `judgeEnabled` (bool) — enable/disable LLM meaningfulness judgment
- `targets` — array of 1–50 target objects
- `webhook` — `{ url, headers, metadata, events: ["monitor.page","monitor.check.completed"] }`
- `notification.email` — `{ enabled, recipients, includeDiffs }`
- `retentionDays` (int, default 30, max 365)

**Webhook events:** `monitor.page`, `monitor.check.completed`

**Check result fields per page:**
- `status` — `"same"` | `"new"` | `"changed"` | `"removed"` | `"error"`
- `judgment` — `{ meaningful, confidence, reason, meaningfulChanges }`
- `diff.text` (markdown mode) | `diff.json` (JSON mode) | both (mixed mode)
- `snapshot.json` — current full extraction (JSON mode)
- `isMeaningful` (bool)

**API endpoints:** create, list, get, update, delete, run, list-checks, get-check

**FOSS alternatives:**
- `changedetection.io` — self-hostable open-source web monitoring (Docker)
- `huginn` — self-hostable agent platform with web monitoring
- `watchtower` — self-hostable change detection
- Custom: cron + `playwright` + `diff` + SQLite + SMTP/webhook notification

---

### 12. LLM-Powered JSON Extraction via Scrape (JSON mode)

**Category:** extract  
**Purpose:** Synchronous single-page structured data extraction using LLM on scraped Markdown. No URL discovery needed. Schema or prompt-based. Part of `/scrape` `formats` array.

**Key Parameters:**
- `formats: [{ type: "json", schema?: object, prompt?: string }]`

**Tips:** Keep schemas < 15 fields per request; use `enum` for constrained fields; use `"type": "array"` for lists; add null-handling in descriptions; use location hints.

**FOSS alternatives:**
- `instructor` (pypi/npm) — structured LLM extraction for OpenAI-compatible APIs
- `outlines` (pypi) — structured generation with local LLMs (llama.cpp/vLLM)
- `marvin` (pypi) — `@ai.extract()` decorator
- `kor` (pypi) — schema-constrained LLM extraction
- `jsonformer` (pypi) — JSON-constrained generation
- `guidance` (pypi) — structured LLM programs

---

### 13. Brand Identity Extraction

**Category:** scrape  
**Purpose:** Extract comprehensive brand identity from a webpage in one call. Returns colors, fonts, typography, spacing, UI components, icons, animations, layout, and brand personality.

**Key Parameters:**
- `formats: ["branding"]` — returns `BrandingProfile` object

**BrandingProfile fields:**
- `colorScheme` (light/dark), `logo` (URL)
- `colors` — primary, secondary, accent, background, textPrimary, textSecondary, link, success, warning, error
- `fonts` — array of font families
- `typography` — fontFamilies (primary/heading/code), fontSizes (h1–body), fontWeights, lineHeights
- `spacing` — baseUnit, borderRadius, padding, margins
- `components` — buttonPrimary, buttonSecondary, input styles
- `icons` — icon style info
- `images` — logo, favicon, og:image URLs
- `animations` — transition settings
- `layout` — grid, header/footer heights
- `personality` — tone, energy, target audience

**FOSS alternatives:**
- `color-thief` (npm/pypi) — dominant colors from images
- `culori` (npm) — color manipulation/analysis
- `playwright` screenshot → color extraction pipeline
- `fontfaceobserver` (npm) — detect active fonts
- Manual CSS parsing with `cheerio` / `cssselect`

---

### 14. Screenshot Capture

**Category:** scrape  
**Purpose:** Take full-page or viewport screenshots of a URL, optionally with custom viewport size and quality. URLs expire after 24 hours.

**Key Parameters (as format object):**
- `{ type: "screenshot", fullPage?: bool, quality?: number, viewport?: { width, height } }`
- Max viewport: 7680×4320. Max one screenshot per request.
- Can be combined with other formats in same request.

**FOSS alternatives:**
- `playwright` (npm/pypi) — `page.screenshot({ fullPage, type, quality })` → Buffer/file
- `puppeteer` (npm) — `page.screenshot()`
- `playwright-screenshot` (npm helper)
- CLI: `npx playwright screenshot url output.png`

---

### 15. Audio/Video Extraction

**Category:** scrape  
**Purpose:** Extract audio (MP3) or best-quality video from supported sites (e.g. YouTube). Returns signed GCS URL (expires 1h).

**Key Parameters:**
- `formats: ["audio"]` → `doc.audio` (signed GCS MP3 URL)
- `formats: ["video"]` → `doc.video` (signed GCS video URL)
- Cost: 5 credits/page (1 base + 4 additional)

**FOSS alternatives:**
- `yt-dlp` (pypi) — download audio/video from 1000+ sites, ffmpeg integration
- `pytube` (pypi) — Python YouTube downloader
- `youtube-dl` (pypi) — original, slower-maintained

---

### 16. Page Query / NL Answer

**Category:** answer-summarize  
**Purpose:** Ask a natural-language question about a scraped page. Returns answer in `answer` field. Available in `/scrape` (per-page) and via `scrapeOptions` in `/search` (per-result).

**Key Parameters:**
- `formats: [{ type: "query", prompt: "question text", mode: "directQuote"|"freeform" }]`
- Max prompt: 10000 chars
- Cost: 5 credits/page (1 base + 4 additional)

**FOSS alternatives:**
- Local LLM + `@mozilla/readability` content extraction + `langchain` Q&A chain
- `RAG pipeline`: scrape → chunk → embed → retrieve → generate (e.g. `llama_index`, `haystack`)
- `haystack` (pypi) — extractive QA
- `transformers` (pypi) + `distilbert` — free extractive QA

---

### 17. Page Highlights (Source-Text Selection)

**Category:** answer-summarize  
**Purpose:** Find relevant quoted text from a scraped page matching a query. Returns selected passages in `highlights` field.

**Key Parameters:**
- `formats: [{ type: "highlights", query: "query text" }]`
- Max query: 10000 chars. Cost: 5 credits/page.

**FOSS alternatives:**
- `bm25` (pypi) — keyword-based passage retrieval
- `sentence-transformers` (pypi) + cosine similarity → top passages
- `haystack` extractive QA / passage retrieval
- `spacy` (pypi) — named entity / span extraction

---

### 18. Page Summary

**Category:** answer-summarize  
**Purpose:** LLM-generated one-call summary of any page.

**Key Parameters:**
- `formats: ["summary"]` — returns `summary` field (string)

**FOSS alternatives:**
- `sumy` (pypi) — extractive summarization (no LLM needed)
- `transformers` (pypi) + `bart-large-cnn` — abstractive summarization
- `gensim` (pypi) — TextRank summarization
- Local LLM via `ollama` / `llama.cpp`

---

### 19. FIRE-1 AI Agent (Browser Navigation for Scrape/Extract)

**Category:** research  
**Purpose:** Older AI navigation agent embedded in `/scrape` or `/extract` via `agent: { model: "FIRE-1", prompt }`. Handles pagination, button clicks, dynamic content loading. Predecessor to `/agent` endpoint.

**Key Parameters:**
- `agent` object in scrape/extract request body:
  - `model` — `"FIRE-1"` (only option)
  - `prompt` (required for scrape) — navigation instructions
- For `/extract`, uses the top-level `prompt` parameter

**FOSS alternatives:** Same as Browser Interaction (Playwright, Puppeteer, crawlee)

---

### 20. Proxy System

**Category:** proxy  
**Purpose:** Route scrape requests through geo-located proxies to bypass blocks, emulate locations, and improve reliability. Three tiers with automatic retry logic.

**Proxy types:**
- `basic` — standard proxies, 1 credit, fast
- `enhanced` — stealth proxies, 5 credits, slower but higher success on protected sites
- `auto` — try basic first, fall back to enhanced on failure; 1 credit if basic succeeds, 5 if enhanced needed

**Supported countries (select):** US (enhanced), NL (enhanced), AU, BR, CA, CN, DE, FR, GB, JP, IN + ~15 more basic

**Key Parameters:**
- `proxy: "basic"|"enhanced"|"auto"` on any scrape/crawl/batch request
- `location.country` — ISO 3166-1 alpha-2 code to select geo-specific proxy

**FOSS alternatives:**
- `crawlee` with proxy rotation via `ProxyConfiguration`
- `scrapy-rotating-proxies` (pypi)
- Free proxy lists: `free-proxy` (pypi), `proxy-list` package
- Self-host: `mitmproxy` (pypi), `3proxy` (C, open-source)
- Residential proxies: no truly free FOSS alternative; Bright Data / Oxylabs are commercial

---

### 21. Lockdown Mode (Cache-Only Scrape)

**Category:** proxy / compliance  
**Purpose:** Compliance and air-gapped mode that never makes outbound requests. Serves only from Firecrawl's existing cache/index. ZDR by default. Returns `SCRAPE_LOCKDOWN_CACHE_MISS` (404) if no cache entry exists.

**Key Parameters:**
- `lockdown: true` on `/v2/scrape`
- Default maxAge bumped to 2 years for cache matching
- Available on: scrape endpoint + all SDKs + CLI (`--lockdown`) + MCP server

**Billing:** 5 credits on cache hit; 1 credit on miss (ZDR surcharge waived)

**FOSS alternatives:**
- Local cache with `node-cache` / `lru-cache` (npm), `diskcache` (pypi)
- `http-proxy-middleware` (npm) + custom cache layer
- `Varnish` / `Nginx` proxy cache (self-hosted)
- `httrack` — offline website copier (self-hosted)

---

### 22. Zero Data Retention (ZDR)

**Category:** proxy / compliance  
**Purpose:** Enterprise feature preventing Firecrawl from persisting any request URL, page content, or response data beyond the request lifetime. Available for scrape and search.

**Key Parameters:**
- `zeroDataRetention: true` on `/v2/scrape`
- `enterprise: ["zdr"]` (full ZDR) or `enterprise: ["anon"]` (anonymized) on `/v2/search`
- Note: screenshots incompatible with ZDR (require persistent storage)

**Cost:** +1 additional credit per page for scrape ZDR. Search ZDR: 10 credits/10 results; anon: 2 credits/10 results.

---

### 23. Caching / Fast Scraping

**Category:** scrape  
**Purpose:** Intelligent result caching delivers cached pages up to 5x faster. Controlled by `maxAge` parameter.

**Key Parameters:**
- `maxAge` (ms, default 172800000 = 2 days) — max acceptable cache age; 0 = always fresh
- `storeInCache` (bool) — opt out of caching this request
- `minAge` (ms) — cache-only lookup (like lockdown but softer)
- `metadata.cacheState` in response — `"hit"` or `"miss"`

**Cache bypass conditions:** Custom `headers`, `actions`, browser `profile`, `changeTracking`, custom screenshot viewport/quality settings.

**FOSS alternatives:**
- `lru-cache` (npm), `node-cache` (npm) — in-memory TTL cache
- `diskcache` (pypi), `joblib` (pypi) — disk-based cache
- `redis` + `ioredis` (npm) / `redis-py` (pypi) — distributed cache
- `cacheman` (npm) — multi-tier cache

---

### 24. Mobile Emulation

**Category:** scrape  
**Purpose:** Emulate a mobile device during scraping to access mobile-specific content layouts. Combine with location for full regional mobile simulation.

**Key Parameters:**
- `mobile: true` on `/v2/scrape`
- Optionally combine with `headers["User-Agent"]` for custom mobile UA string
- `location.country` + `location.languages` for regional simulation
- `formats: [{ type: "screenshot", viewport: { width: 390, height: 844 } }]` to verify

**FOSS alternatives:**
- `playwright` — `browser.newContext({ ...devices["iPhone 14"] })`
- `puppeteer` — `page.emulate(devices['iPhone X'])`

---

### 25. Webhooks

**Category:** other  
**Purpose:** Real-time event notifications for long-running async jobs. Signed with HMAC-SHA256 (`X-Firecrawl-Signature` header) for security verification.

**Events by job type:**
- Crawl: `crawl.started`, `crawl.page`, `crawl.completed`, `crawl.failed`
- Batch scrape: `batch_scrape.started`, `batch_scrape.page`, `batch_scrape.completed`, `batch_scrape.failed`
- Monitor: `monitor.page`, `monitor.check.completed`
- Agent: `webhook-agent-completed`

**Webhook config:** `{ url, headers, metadata, events }`

**FOSS alternatives:**
- `svix` (open-source webhook delivery service, self-hostable)
- `standard-webhooks` (npm/pypi) — signature verification spec
- `hmac` (built-in) — implement HMAC-SHA256 verification manually

---

### 26. AI Support / Debug API (`/v2/support/ask`, `/v2/support/docs-search`)

**Category:** other  
**Purpose:** Agentic debugging API. Diagnose failing scrapes/crawls/agents and receive structured `fixParameters` to apply in a retry. Intended for AI agent callers.

**Key Parameters (`/support/ask`):**
- `question` (required, 1–8000 chars) — describe the issue
- `rationale` (string) — end-user goal context
- `context` (object) — free-form metadata

**Response fields:**
- `answer` — 2–4 sentence diagnosis
- `confidence` — `"high"` | `"medium"` | `"low"`
- `fixParameters` — machine-actionable params for retry
- `validation` — `{ tested, result, evidence }` — live validation against API
- `durationMs`

**`/support/docs-search`:**
- `question` (required)
- Returns: `answer`, `evidence` array (pathOrUrl + reason), `usage`
- Latency: 15–30s typical, 60s max

**FOSS alternatives:** None direct (this is a product-specific AI assistant); closest is RAG over docs with `langchain`/`haystack`

---

## Endpoint Summary Table

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/scrape` | POST | Single-page scrape in any format |
| `/v2/scrape/{scrapeId}/interact` | POST | Browser interaction after scrape |
| `/v2/scrape/{scrapeId}/interact` | DELETE | Stop interact session |
| `/v2/crawl` | POST | Recursive site crawl |
| `/v2/crawl/{id}` | GET | Poll crawl status/results |
| `/v2/crawl/{id}` | DELETE | Cancel crawl |
| `/v2/crawl/{id}/errors` | GET | Retrieve pages that failed to scrape |
| `/v2/crawl/params-preview` | POST | Preview crawl params from NL prompt |
| `/v2/map` | POST | Fast URL discovery for a domain |
| `/v2/extract` | POST | Multi-URL structured extraction (legacy) |
| `/v2/extract/{id}` | GET | Poll extract job |
| `/v2/agent` | POST | Autonomous agentic extraction |
| `/v2/agent/{id}` | GET | Poll agent job |
| `/v2/agent/{id}` | DELETE | Cancel agent job |
| `/v2/batch/scrape` | POST | Batch scrape multiple URLs |
| `/v2/batch/scrape/{id}` | GET | Poll batch scrape |
| `/v2/batch/scrape/{id}/errors` | GET | Errors from batch scrape |
| `/v2/search` | POST | Web search (+ optional content scrape) |
| `/v2/parse` | POST | Parse local/non-public document file |
| `/v2/monitor` | POST | Create monitor |
| `/v2/monitor/{id}` | GET/PUT/DELETE | Manage monitor |
| `/v2/monitor/{id}/run` | POST | Trigger manual check |
| `/v2/monitor/{id}/checks` | GET | List monitor checks |
| `/v2/monitor/{id}/checks/{checkId}` | GET | Get check detail |
| `/v2/support/ask` | POST | Agentic debug/diagnosis |
| `/v2/support/docs-search` | POST | Docs-grounded QA |
| `/v2/browser` | POST/GET/DELETE | Standalone browser session management |

---

## Coverage Notes
- **totalUrls:** 1182
- **deepReadCount:** 30
- All 30 pre-selected URLs successfully scraped (0 errors).
- Non-English i18n variants (pt-BR, es, fr, ja, zh) represent ~60% of URL inventory — not individually scraped but categorized from path analysis.
- Remaining ~120 English URLs not deep-read (API reference endpoint detail pages, webhook payload schemas, SDK quickstarts) — covered adequately by feature page reads.
- Features `features/models` (agent model selection) and browser sandbox (`features/browser`) were identified in cross-references but not in pre-selected list; core info captured from `features/agent` and `features/interact` reads.
