# Nimble Web API — Feature Catalog for webular

**Source:** https://docs.nimbleway.com  
**Deep-read count:** 30 pages (28 fully read, 2 read via key-section sampling due to size)  
**Total URLs in inventory:** 116  
**Coverage:** All 30 pre-selected feature/API pages read; remaining 86 URLs categorized from path/title without full scrape.

---

## URL Inventory — Capability Bucket Categorization

| Bucket | Count | URLs |
|---|---|---|
| **scrape/extract** | 12 | `/api-reference/extract/*` (extract, extract-async, extract-batch), `/nimble-sdk/web-tools/extract/quickstart`, `/nimble-sdk/web-tools/extract/features/*` (js-rendering, geo-targeting, parsing-schema, stealth-mode, browser-actions, async, advanced-options, formats, network-capture, headers-and-cookies) |
| **serp** | 6 | `/api-reference/serp/*` (serp, serp-async, serp-batch), `/nimble-sdk/web-tools/serp`, `/nimble-sdk/web-tools/fast-serp`, `/nimble-sdk/web-tools/search-depth` |
| **search** | 3 | `/api-reference/search/search`, `/nimble-sdk/web-tools/search`, `/nimble-sdk/web-tools/search-depth` |
| **crawl** | 5 | `/api-reference/crawl/*` (create-crawl, crawl-by-id, list-crawls, cancel-crawl), `/nimble-sdk/web-tools/crawl` |
| **map** | 3 | `/api-reference/map/map`, `/nimble-sdk/web-tools/map`, `/api-reference/map/map` |
| **agents/other** | 8 | `/api-reference/agents/*` (agent-run, agent-async, agent-batch, generate-agent, get-agent-details, get-generation, list-agents), `/nimble-sdk/agentic/*` (agents, agent-creation, agent-gallery, jobs, studio) |
| **tasks/async** | 5 | `/api-reference/tasks/*` (task-result, task-status, get-batch-details, get-batch-progress, list-batches, list-tasks) |
| **media** | 2 | `/api-reference/media/*` (media-download, media-download-async), `/nimble-sdk/web-tools/media` |
| **proxy** | 9 | `/nimble-sdk/web-tools/proxy/*` (quickstart, geotargeting, authentication, session-control, response-codes, unlocker-proxy), `/integrations/proxy/*` (overview + 15 integration guides) |
| **domain-knowledge** | 2 | `/api-reference/domain-knowledge/get-driver`, `/nimble-sdk/web-tools/domain-knowledge` |
| **admin** | 4 | `/nimble-sdk/admin/*` (account-management, callbacks-and-delivery, pricing, rate-limits) |
| **integrations** | 16 | MCP server, LangChain, OpenAI, Anthropic, Google ADK, Smithery, Databricks, Snowflake, Microsoft/Azure, agent-skills (business-research, marketing, productivity, seo, nimble-agent-builder, nimble-web-expert) |
| **SDK/getting-started** | 9 | `/nimble-sdk/getting-started/*`, `/nimble-sdk/sdks/*` (python, node, go, cli, skills) |
| **other** | 7 | home, changelog/release-notes, guides/build-first-agent-tutorial, `https://docs.nimbleway.com` (root) |

---

## Feature Catalog

### 1. Page Extraction (Extract)

**Category:** scrape  
**Endpoints:** `POST /v1/extract` (sync), `POST /v1/extract/async`, `POST /v1/extract/batch`  
**SDK methods:** `nimble.extract(...)`, `nimble.extract_async(...)`, `nimble.extract_batch(...)`  
**Purpose:** Retrieve and parse content from any single URL. Returns HTML, markdown, screenshot, HTTP headers, and/or structured parsed data.

**Key Parameters:**
- `url` (required) — target URL
- `render` (bool) — enable JavaScript execution via headless/headful browser
- `driver` — extraction engine: `vx6` (fast HTTP, no JS), `vx8` (headless+JS), `vx8-pro` (headful+JS), `vx10` (stealth headless), `vx10-pro` (stealth headful, maximum anti-bot)
- `formats` — array: `html`, `markdown`, `screenshot`, `headers`, `links`
- `parse` (bool) — enable CSS-selector-based structured data extraction
- `parser` (object) — custom extraction recipe (see Parsing Schema feature)
- `country`, `state`, `city` — geo-targeting via residential proxy exit
- `locale` — LCID language code for Accept-Language header
- `browser_actions` — sequential browser automation steps (see Browser Actions)
- `network_capture` — intercept and record network requests during render
- `headers` — custom HTTP request headers
- `cookies` — custom cookies to inject
- `referrer_type` — referrer policy: `random`, `no-referrer`, `same-origin`, `google`, `bing`, `facebook`, etc.
- `expected_status_codes` — treat non-200 codes as success
- `http2` — force HTTP/2
- `session` — persist browser session across calls (`id`, `timeout`, `retry`, `prefetch_userbrowser`)
- `device` — emulation: `desktop`, `mobile`, `tablet`
- `tag` — user-defined request label for analytics
- `render_options` — fine-grained render control: `render_type` (load/domready/idle0/idle2), `timeout`, `include_iframes`, `disabled_resources`, `blocked_domains`, retry flags
- `method` — HTTP method (GET/POST/PUT/PATCH/DELETE)
- `is_xhr` — emulate XHR request behavior
- `no_userbrowser` — disable browser-based rendering explicitly

**Async-specific extras:**
- `storage_type` — `s3` or `gs` (Google Cloud Storage)
- `storage_url` — bucket path for result delivery
- `storage_compress` — GZIP compress stored results
- `storage_object_name` — custom filename prefix
- `callback_url` — webhook fired on task completion

**Batch:**
- `inputs` — array of up to 1,000 per-URL objects (each inherits `shared_inputs`)
- `shared_inputs` — default extraction params applied to all inputs

**Response data fields:**
- `data.html`, `data.markdown`, `data.parsing`, `data.screenshot` (base64 PNG), `data.headers`, `data.cookies`, `data.network_capture`, `data.browser_actions`, `data.fetch`

**FOSS Candidates (npm/pypi/cargo):**
- `playwright` (npm/pypi) — browser automation, JS rendering, screenshot
- `puppeteer` (npm) — headless Chrome control
- `crawlee` (npm) — high-level scraping framework on top of Playwright/Cheerio
- `cheerio` (npm) — fast HTML parsing and CSS-selector extraction
- `@mozilla/readability` (npm) — article text extraction (readability)
- `turndown` (npm) — HTML-to-Markdown conversion
- `node-html-parser` / `htmlparser2` (npm) — lightweight HTML parsing
- `playwright-extra` + `puppeteer-extra-plugin-stealth` (npm) — anti-bot evasion
- `got` / `axios` / `undici` (npm) — HTTP client for non-rendered pages
- `python-requests` + `httpx` (pypi) — HTTP clients
- `beautifulsoup4` / `lxml` (pypi) — Python HTML/XML parsing

---

### 2. JavaScript Rendering

**Category:** scrape  
**Purpose:** Full browser execution to load SPA content, AJAX responses, and dynamic DOM. Controlled via `render: true` + `driver` + `render_options`.

**Key Parameters (within extract):**
- `render: true` — required to enable
- `driver` — vx6/vx8/vx8-pro/vx10/vx10-pro (auto-selected when just `render: true`)
- `render_options.render_type` — `load` | `domready` | `idle2` | `idle0`
- `render_options.timeout` — ms, default 30000
- `render_options.include_iframes` — capture iframe content
- `render_options.blocked_domains` — suppress ad/tracking domains
- `render_options.disabled_resources` — block resource types: image, stylesheet, font, media, script, xhr, fetch

**FOSS Candidates:**
- `playwright` (npm/pypi) — full browser + network interception + wait-for-networkidle
- `puppeteer` (npm) — headless Chrome
- `selenium-webdriver` (npm/pypi) — cross-browser
- `rod` (Go) — Chromium DevTools Protocol client
- `ferrum` (pypi) — Ferrum Chrome control

---

### 3. Stealth Mode / Anti-Bot Evasion

**Category:** scrape  
**Purpose:** Bypass CAPTCHA, fingerprinting, and bot-detection systems via driver selection and advanced evasion.

**Key Parameters:**
- `driver` — `vx10` (stealth headless), `vx10-pro` (stealth headful, maximum protection)
- OS/browser emulation: `os` (windows/mac/linux/android/ios), `browser` (chrome/firefox), `device` (desktop/mobile/tablet)
- `no_userbrowser: false` (default) — keep browser-based rendering

**FOSS Candidates:**
- `playwright-extra` + `puppeteer-extra-plugin-stealth` (npm) — randomize fingerprints, bypass Cloudflare
- `undetected-chromedriver` (pypi) — patched Selenium Chrome
- `botasaurus` (pypi) — high-level anti-bot scraping framework
- `cf-clearance-scraper` (npm) — Cloudflare challenge solver
- `rebrowser-patches` (npm) — Playwright/Puppeteer leak patches

---

### 4. Browser Actions (Automation)

**Category:** scrape  
**Purpose:** Sequential browser interaction steps executed before content extraction. Enables form filling, pagination, infinite scroll, and multi-step navigation.

**Available Actions:**
- `goto` — navigate to URL (with `wait_until`, `referer`, `timeout`)
- `wait` — pause for duration (e.g., `"2s"`, `"500ms"`)
- `wait_for_element` — wait for CSS selector to appear (with `timeout`, `visible`)
- `click` — click by CSS selector or coordinates (with `timeout`, `delay`, `count`, `scroll`, `strategy`)
- `press` — keyboard key press (Enter, Tab, Escape, ArrowDown, etc.)
- `fill` — type or paste text into input (with `mode`: type/paste, `typing_interval`, `click_on_element`)
- `scroll` — scroll by pixels, to element, or to `"bottom"` (with `container`, `x`, `y`)
- `auto_scroll` — intelligent auto-scroll for infinite feeds (with `max_duration`, `idle_timeout`, `click_selector`, `step_size`, `delay_after_scroll`)
- `screenshot` — capture page screenshot (PNG/JPEG/WEBP, `full_page`, `quality`)
- `get_cookies` — collect browser cookies (with `domain` filter)
- `fetch` — make HTTP request from browser context (GET/POST/PUT/DELETE with headers/body)

**Global timeout:** 240 seconds for all actions combined  
**`required: false`** — mark individual steps as optional (flow continues on failure)

**FOSS Candidates:**
- `playwright` (npm/pypi) — full action API: click, fill, scroll, navigate, screenshot, wait-for-selector
- `puppeteer` (npm) — equivalent action set
- `selenium-webdriver` (npm/pypi)
- `robotframework-browser` (pypi) — Playwright-backed test automation
- `pyppeteer` (pypi) — Python Puppeteer port

---

### 5. CSS-Selector Parsing Schema

**Category:** parse  
**Purpose:** Define structured extraction recipes using CSS selectors, XPath, or JSON paths. Returns typed, nested output objects from HTML pages.

**Parser Types:**
- `terminal` — single value from one element
- `terminal_list` — list of values from multiple elements
- `schema` — nested object using sub-parsers
- `schema_list` — list of objects
- `or` — try multiple strategies, return first non-null
- `and` — run multiple strategies and combine results
- `const` — return a fixed hardcoded value

**Selector Types:**
- `css` — CSS selector with `css_selector` field
- `xpath` — XPath expression
- JSON path (for network-captured JSON responses)

**Extractor Types:**
- `text` — text content
- `attr` — HTML attribute value (e.g., `href`, `src`)
- `json` — parse embedded JSON
- `raw` — raw HTML string

**Post-Processors:** `number`, date formatting, text cleaning

**FOSS Candidates:**
- `cheerio` (npm) — CSS selector extraction on parsed HTML
- `xpath` / `xpath-ts` (npm) — XPath queries on DOM
- `css-select` (npm) — standalone CSS selector engine
- `jsdom` (npm) — full DOM environment for complex selectors
- `cssselect` (pypi) — Python CSS selectors on lxml trees
- `parsel` (pypi) — Scrapy's standalone CSS/XPath selector
- `beautifulsoup4` (pypi) — CSS and tag-based selectors
- `lxml` (pypi) — XPath and CSS on HTML/XML

---

### 6. Network Capture (API Interception)

**Category:** scrape  
**Purpose:** Intercept XHR/fetch requests made by the browser during page load. Capture API responses for sites where data is loaded via background API calls rather than in the initial HTML.

**Key Parameters:**
- `network_capture` (array) — list of capture rules:
  - `method` — HTTP method filter (GET/POST/etc.)
  - `url` — URL match rule: `type` (`exact`, `contains`, `regex`), `value`
  - `resource_type` — filter by: `xhr`, `fetch`, `script`, `stylesheet`, etc.

**Response:** `data.network_capture` — array of captured request/response objects

**FOSS Candidates:**
- `playwright` (npm/pypi) — `page.route()` and `page.on('request'/'response')` for full interception
- `puppeteer` (npm) — `page.on('request')`/`page.setRequestInterception(true)`
- `mitmproxy` (pypi) — standalone proxy-based interception
- `nock` (npm) — HTTP interceptor for Node.js

---

### 7. Output Formats (HTML/Markdown/Screenshot)

**Category:** scrape  
**Purpose:** Choose how extracted page content is returned.

**Formats:**
- `html` — raw HTML of the page
- `markdown` — page converted to Markdown
- `screenshot` — full-page base64-encoded PNG
- `headers` — HTTP response headers from the target server
- `links` — all links extracted from the page

**FOSS Candidates (for each format):**
- Markdown: `turndown` (npm), `html2md` (npm), `markdownify` (pypi), `html2text` (pypi)
- Screenshot: `playwright` (npm/pypi), `puppeteer` (npm)
- HTML: direct `fetch` + any parser
- Links: `cheerio` (npm), `beautifulsoup4` (pypi), `a-href` patterns

---

### 8. SERP (Search Engine Results Page)

**Category:** serp  
**Endpoints:** `POST /v1/serp` (sync), `POST /v1/serp/async`, `POST /v1/serp/batch`  
**SDK methods:** `nimble.serp(...)` (inferred from docs pattern)  
**Purpose:** Query search engines and return parsed, structured SERP entity data. Returns `OrganicResult`, `AnswerBox`, `Pagination`, `RelatedQuestion`, `RelatedSearch`, `MapsListing`, `MapsReview`, `NewsResult`, `ImageResult`, etc.

**Key Parameters:**
- `search_engine` (required) — `google_search`, `google_aio` (AI Overview), `google_news`, `google_images`, `google_maps_search`, `google_maps_place`, `google_maps_reviews`, `bing_search`, `yandex_search`
- `query` — search query string
- `place_id` / `data_id` — Google Maps place identifier (for maps engines)
- `coordinates` — `{latitude, longitude}` for maps
- `country` — ISO Alpha-2 (default: US)
- `locale` — LCID language code
- `location` — location string or Google UULE value
- `time` — recency filter: `hour`, `day`, `week`, `month`, `year`
- `num_results` — 1–100 results
- `start` — pagination offset
- `no_html` — omit raw HTML from response
- `include_pages_html` — return per-result HTML instead of stitched string
- `device` — `mobile` emulation
- `ads_optimization` — boost sponsored results via incognito rendering
- Async extras: `storage_type`, `storage_url`, `callback_url`, `storage_compress`, `storage_object_name`
- Batch: `inputs[]` + `shared_inputs`

**Response pagination helpers:** `nimble_links` (Maps), `nimble_payload` (web searches)  
**SLA:** ~3s p50, ~10s p90, 83 QPS default, up to 1,000 QPS on enterprise

**FOSS Candidates:**
- `google-search-results-nodejs` / `serpapi` (npm) — SerpAPI client (paid tier but FOSS client)
- `ddg` / `duckduckgo-search` (pypi/npm) — DuckDuckGo search (no API key needed)
- `googlesearch-python` (pypi) — scrape Google search results
- `yandex-search` (npm) — unofficial Yandex search
- `playwright` + custom parser (npm/pypi) — scrape Google directly
- SearXNG (self-hosted meta-search engine) — open-source, no rate limits
- Brave Search API (free tier, 2,000 req/month)
- `brave-search` (npm) — Brave Search client

---

### 9. Web Search with Content Extraction

**Category:** search  
**Endpoint:** `POST /v1/search`  
**SDK method:** `nimble.search(...)`  
**Purpose:** Search the web and return structured results with optional full-page content. Powered by Web Search Agents (WSAs) that understand intent. Includes optional LLM-generated answer summary.

**Key Parameters:**
- `query` (required)
- `locale` (default: `en`), `country` (default: `US`)
- `max_results` — 1–100 (default: 3)
- `search_depth` — `lite` (metadata only, 1 credit), `fast` (rich content, 2 credits, enterprise), `deep` (full page scrape, 1+1/page credit)
- `focus` — single mode or array of agent names:
  - Pre-defined: `general`, `news`, `coding`, `academic`, `shopping`, `social`, `geo`, `location`
  - Custom: array of WSA names, e.g. `["amazon_serp", "walmart_serp", "reddit_discover_posts"]`
- `output_format` — `plain_text`, `markdown`, `simplified_html`
- `include_answer` — LLM-powered answer summary from snippets
- `content_type` — filter by document type (only with `focus: "general"`): `pdf`, `docx`, `xlsx`, `pptx`, or semantic groups `documents`, `spreadsheets`, `presentations`
- `exclude_domains`, `include_domains` — up to 50 each
- `start_date`, `end_date` — date range filters (YYYY-MM-DD or YYYY)
- `time_range` — `hour`, `day`, `week`, `month`, `year`
- `max_subagents` — 1–10 parallel subagents for WSA focus modes

**Response:** `total_results`, `results[]` (title, description, url, content, metadata), `answer`, `request_id`

**FOSS Candidates:**
- `duckduckgo-search` (pypi) — DDG search with no API key
- SearXNG (self-hosted) — meta-search aggregating 70+ engines
- `searx` (pypi) — Python SearX client
- Brave Search API free tier
- `exa` SDK (npm/pypi) — neural search (separate paid service, FOSS SDK)
- `tavily-python` (pypi) — Tavily search (FOSS SDK, paid API)
- Custom: `playwright` search + `@mozilla/readability` + `turndown` for deep content

---

### 10. Site Mapping

**Category:** map  
**Endpoint:** `POST /v1/map`  
**SDK method:** `nimble.map(...)` (inferred)  
**Purpose:** Discover all URLs on a website using sitemaps and link crawling. Returns URL list with optional titles and descriptions.

**Key Parameters:**
- `url` (required) — root URL to map
- `sitemap` — `skip`, `include` (default), `only`
- `country`, `locale` — geo/language targeting
- `domain_filter` — `domain` | `subdomain` | `all` (include/exclude subdomains)
- `limit` — 1–100,000 URLs

**Response:** `task_id`, `success`, `links[]` (url, title?, description?)

**FOSS Candidates:**
- `sitemapper` (npm) — parse XML sitemaps
- `sitemap-stream-parser` (npm) — stream sitemap URLs
- `python-sitemap` / `advertools` (pypi) — sitemap parsing
- `crawlee` (npm) — BFS link crawl with URL discovery
- Custom BFS crawler: `got`/`axios` + `cheerio` + queue (npm)
- `scrapy` (pypi) — built-in link extractor + sitemap spider

---

### 11. Website Crawling

**Category:** crawl  
**Endpoints:** `POST /v1/crawl` (create), `GET /v1/crawl/{id}` (status), `GET /v1/crawl` (list), `DELETE /v1/crawl/{id}` (cancel)  
**SDK methods:** `nimble.crawl.run(...)`, `nimble.crawl.status(crawl_id)`, `nimble.crawl.list()`, `nimble.crawl.terminate(crawl_id)`  
**Purpose:** Systematically crawl entire websites asynchronously. Discovers pages via sitemaps + link following; each page becomes an independent extraction task.

**Key Parameters:**
- `url` (required) — starting URL
- `name` — optional crawl label
- `sitemap` — `skip`, `include` (default), `only`
- `limit` — 1–10,000 pages (default: 5,000)
- `max_discovery_depth` — 1–20 link hops (default: 5)
- `crawl_entire_domain` — follow all internal links including parent/sibling paths
- `allow_subdomains` — follow subdomain links
- `allow_external_links` — follow external links
- `include_paths` — regex patterns to whitelist URL paths
- `exclude_paths` — regex patterns to blacklist URL paths
- `ignore_query_parameters` — deduplicate URLs by path only
- `callback` — webhook config: `url`, `headers`, `metadata`, `events` (started/page/completed/failed)
- `extract_options` — full Extract API options applied to each page (driver, formats, parse, parser, etc.)
- `country`, `locale` — geo/language targeting

**Status fields:** `status` (queued/running/succeeded/failed/canceled), `total`, `pending`, `completed`, `failed`, `tasks[]`

**FOSS Candidates:**
- `crawlee` (npm) — production-grade crawler with Playwright/Cheerio adapters, async queue, sitemap support
- `scrapy` (pypi) — full crawl framework with spiders, pipelines, async
- `colly` (Go) — fast Go crawler
- `goquery` (Go) — CSS selector extraction (complement to colly)
- Custom BFS: `playwright` + queue + URL dedup (npm/pypi)
- `apify/sdk` (npm) — SDK layer over Crawlee (open-source core)
- `nutch` (Java) — Apache Nutch large-scale crawler
- `heritrix` (Java) — Internet Archive's web crawler

---

### 12. Web Search Agents (Pre-built + Custom)

**Category:** agents  
**Endpoints:** `POST /v1/agents/run` (sync), `POST /v1/agents/async`, `POST /v1/agents/batch`  
**SDK methods:** `nimble.agents.run(...)`, `nimble.agents.async_run(...)`, `nimble.agents.batch(...)`  
**Purpose:** Run pre-built site-specific extraction agents (e.g., `amazon_pdp`, `amazon_serp`, `google_search`, `walmart_serp`, `reddit_discover_posts`) or custom agents created in Nimble Studio. Returns structured parsed data without requiring CSS selectors.

**Key Parameters:**
- `agent` (required) — agent name, e.g. `"amazon_pdp"`, `"google_search"`
- `params` (required) — agent-specific inputs (e.g., `{asin: "B0DLKFK6LR"}` for Amazon, `{query: "..."}` for search)
- `localization` — enable geo-localized results (uses `zip_code` or `store_id`)
- `formats` — additional formats alongside structured data: `html`, `markdown`, `headers`, `links`
- Async extras: `storage_type`, `storage_url`, `callback_url`
- Batch: `inputs[]` (per-params overrides) + `shared_inputs` (shared agent + delivery config)

**FOSS Candidates:**
- `crawlee` + custom actor pattern (npm) — build site-specific scrapers as reusable modules
- `scrapy` + custom spiders (pypi) — site-specific scrapers
- `apify/store` community actors — many pre-built open-source scrapers
- `browserless` (npm/Docker) — headless browser service for custom agents

---

### 13. Async Task Management

**Category:** tasks  
**Endpoints:** `GET /v1/tasks/{task_id}` (status), `GET /v1/tasks/{task_id}/results` (results), `GET /v1/tasks` (list, paginated), `GET /v1/batches/{batch_id}` (batch details), `GET /v1/batches/{batch_id}/progress` (lightweight progress), `GET /v1/batches` (list batches)  
**Purpose:** Poll or retrieve results for any async operation (extract, serp, search, map, agent, crawl). Common pattern: submit async request → get task_id → poll status → fetch results.

**Task States:** `pending`, `in_progress`, `success`, `error`  
**Data Retention:** 24–48 hours (indefinite with `storage_url`)  
**Delivery modes:** polling, webhook (`callback_url`), cloud storage (S3/GCS)

**FOSS Candidates:**
- `bull` / `bullmq` (npm) — Redis-backed job queue
- `celery` (pypi) — distributed async task queue
- `p-queue` / `bottleneck` (npm) — concurrency-limited async queues
- `asyncio` + `aiohttp` (pypi) — native Python async patterns
- `node-cron` (npm) — scheduled task execution

---

### 14. Media Download

**Category:** media  
**Endpoints:** `POST /v1/media` (sync), `POST /v1/media/async`  
**Purpose:** Download media files (images, videos, documents) through Nimble's residential proxy network, bypassing geo-restrictions on media URLs.

**Key Parameters:**
- `url` (required) — media file URL
- `country` (default: US) — routing country
- `locale` — language preference
- `expected_mime_types` — allowlist of MIME types, supports wildcards (e.g., `["image/*", "video/mp4"]`)

**Response:** raw binary file (200 image/*)

**FOSS Candidates:**
- `got` / `axios` + stream (npm) — stream-based file download
- `python-requests` with `stream=True` (pypi)
- `yt-dlp` (pypi) — media download for video/audio platforms
- `gallery-dl` (pypi) — image gallery downloader
- `wget` / `curl` — CLI tools

---

### 15. Residential Proxy Network

**Category:** proxy  
**Connection:** HTTP BackConnect gateway at `ip.nimbleway.com:7000`  
**Format:** `http://account-{name}-pipeline-{name}-{params}:{password}@ip.nimbleway.com:7000`  
**Purpose:** Route HTTP requests through real residential IPs from 195+ countries. Enables geo-specific content access, avoids blocks, and maintains session consistency.

**Key Parameters (connection string):**
- `country-{ISO2}` — country targeting (e.g., `country-US`, `country-DE`)
- `state-{code}` — US/CA state targeting (e.g., `state-CA`)
- `city-{name}` — city targeting (e.g., `city-new_york` — underscores for spaces)
- `session-{id}` — sticky session: reuse same IP
- `geosession-{id}` — geo-consistent session: new IPs stay within 175km, same ASN

**Notes:**
- Requires KYC verification (not self-service)
- IP rotation is automatic by default
- Geo-session: minimum 16-char alphanumeric session ID, US-only currently
- Response 525 = no IP available for that location

**FOSS Candidates:**
- `proxy-chain` (npm) — proxy chaining and MITM proxy server
- `mitmproxy` (pypi) — scriptable proxy with Python API
- `3proxy` (self-hosted) — lightweight proxy server
- `dante` (self-hosted) — SOCKS5 proxy server
- Tor + `stem` (pypi) — anonymized routing (not residential)
- `goproxy` (Go) — HTTP/HTTPS proxy server

---

### 16. Geo-Targeting for Extraction

**Category:** proxy  
**Purpose:** Route extraction requests through residential IPs in specific countries, states, or cities. Built into Extract, SERP, Search, Crawl, and Map APIs.

**Key Parameters:**
- `country` — ISO Alpha-2 (`US`, `GB`, `DE`, etc.), or `ALL` for random
- `state` — US/CA only, ISO Alpha-2 state code (`NY`, `CA`, etc.)
- `city` — city name with underscores (`new_york`, `london`, `paris`)
- `locale` — LCID locale code or `"auto"` (auto-match to country)

**Common Use Cases:** localized pricing/availability, SEO market research, regional SERP data, geo-restricted content.

**FOSS Candidates:**
- Residential proxy services with free tiers (various, mostly paid)
- Tor + exit node selection (limited country control)
- VPN providers with API (some have FOSS clients)
- Self-hosted datacenter proxies with geo-IP routing

---

### 17. Output Format: Markdown Conversion

**Category:** scrape  
**Purpose:** Convert extracted HTML to clean Markdown, automatically included when `formats: ["markdown"]` is specified.

**FOSS Candidates:**
- `turndown` (npm) — HTML-to-Markdown, configurable rules
- `@mozilla/readability` (npm) — extract article text first, then convert
- `html2text` (pypi) — Python HTML-to-Markdown/text
- `markdownify` (pypi) — another HTML-to-Markdown converter
- `unified` + `rehype-remark` (npm) — AST-based pipeline

---

### 18. Domain Knowledge / Driver Selection

**Category:** other  
**Endpoint:** `GET /api-reference/domain-knowledge/get-driver`  
**Purpose:** Query Nimble's internal domain knowledge base to determine which extraction driver (vx6/vx8/vx10) is recommended for a given domain. Used to auto-select optimal driver without trial and error.

**FOSS Candidates:**
- Manual mapping table or heuristic: default vx6, escalate to vx10 on bot-detection signals
- `robots-txt` parser + domain rules

---

### 19. Custom Headers and Cookies

**Category:** scrape  
**Purpose:** Inject custom HTTP request headers and cookies into extraction requests. Enables authenticated scraping, session reuse, custom user-agents.

**Key Parameters:**
- `headers` (object) — key-value HTTP headers, e.g. `{"Authorization": "Bearer token", "User-Agent": "custom"}`
- `cookies` (array) — per-cookie objects: `{key, value, domain}`

**FOSS Candidates:**
- `playwright` — `page.setExtraHTTPHeaders()`, `context.addCookies()`
- `puppeteer` — `page.setExtraHTTPHeaders()`, `page.setCookie()`
- `httpx` (pypi) — custom headers + cookie jar
- `requests.Session` (pypi) — persistent headers/cookies

---

### 20. Webhook / Callback Delivery

**Category:** async/other  
**Purpose:** Receive POST notification to a webhook URL when async tasks complete. Nimble sends task metadata (without result data) so the receiver knows to fetch results.

**Key Parameters:**
- `callback_url` — your webhook endpoint
- Crawl: `callback.url`, `callback.headers`, `callback.metadata`, `callback.events` (started/page/completed/failed)

**FOSS Candidates:**
- `ngrok` / `localtunnel` (npm) — expose local webhook endpoints for development
- `express` (npm) — simple webhook receiver
- `fastapi` (pypi) — Python webhook receiver
- `svix` (npm/pypi) — webhook delivery infrastructure (open-source core)
- `hookdeck` — webhook proxy (has free tier)

---

### 21. Cloud Storage Delivery (S3/GCS)

**Category:** async  
**Purpose:** Deliver async task results directly to S3 or Google Cloud Storage instead of Nimble's servers. Enables long-term retention and pipeline integration.

**Key Parameters:**
- `storage_type` — `s3` or `gs`
- `storage_url` — `s3://bucket/path/prefix/` or `gs://bucket/path/`
- `storage_compress` — GZIP compress before saving
- `storage_object_name` — custom filename (default: task_id)

**FOSS Candidates:**
- `@aws-sdk/client-s3` (npm) — AWS S3 SDK
- `boto3` (pypi) — AWS Python SDK
- `@google-cloud/storage` (npm) — GCS SDK
- `google-cloud-storage` (pypi) — GCS Python SDK
- `minio` (npm/pypi) — self-hosted S3-compatible storage

---

### 22. Session Persistence (Browser Sessions)

**Category:** scrape  
**Purpose:** Reuse a browser context across multiple Extract calls, preserving login state, cookies, and navigation history.

**Key Parameters:**
- `session.id` — shared session identifier
- `session.timeout` — TTL in seconds
- `session.retry` — retry within same session on failure
- `session.prefetch_userbrowser` — preload browser for faster first request

**FOSS Candidates:**
- `playwright` — `BrowserContext` with persistent storage state
- `puppeteer` — `browser.createIncognitoBrowserContext()` with cookies
- `mechanize` (pypi) — stateful HTTP browser with cookie jar

---

## Summary Table

| Feature | API Endpoint(s) | Key Params | FOSS Alternatives |
|---|---|---|---|
| Page Extraction | `/v1/extract` (sync/async/batch) | url, render, driver, formats, parser | playwright, puppeteer, crawlee, cheerio |
| JS Rendering | extract `render: true` | driver (vx8/vx10), render_options | playwright, puppeteer, selenium |
| Stealth Mode | extract `driver: vx10/vx10-pro` | driver, os, browser | playwright-extra-stealth, undetected-chromedriver |
| Browser Actions | extract `browser_actions` | goto, click, fill, scroll, auto_scroll, screenshot, fetch | playwright, puppeteer |
| CSS Parsing Schema | extract `parse/parser` | type, selector (css/xpath), extractor, post_processor | cheerio, parsel, lxml, cssselect |
| Network Capture | extract `network_capture` | url match, method, resource_type | playwright page.route(), mitmproxy |
| Output Formats | extract `formats` | html, markdown, screenshot, headers, links | turndown, @mozilla/readability |
| SERP | `/v1/serp` (sync/async/batch) | search_engine, query, country, num_results | duckduckgo-search, SearXNG, Brave API |
| Web Search | `/v1/search` | query, search_depth, focus, include_answer, content_type | duckduckgo-search, SearXNG, exa |
| Site Map | `/v1/map` | url, sitemap, domain_filter, limit | sitemapper, crawlee, scrapy |
| Crawl | `/v1/crawl` (CRUD) | url, limit, include/exclude_paths, extract_options, callback | crawlee, scrapy, colly |
| Agents | `/v1/agents/run` (sync/async/batch) | agent name, params | crawlee custom actors, scrapy spiders |
| Task Management | `/v1/tasks/*` `/v1/batches/*` | task_id, polling, webhook, S3/GCS | bullmq, celery, asyncio queues |
| Media Download | `/v1/media` (sync/async) | url, expected_mime_types | got/axios streams, yt-dlp |
| Residential Proxy | BackConnect `ip.nimbleway.com:7000` | country, state, city, session, geosession | mitmproxy, 3proxy, Tor |
| Geo-Targeting | All extraction APIs | country, state, city, locale | Proxy + IP rotation |
| Markdown Output | extract `formats: ["markdown"]` | — | turndown, html2text, markdownify |
| Headers/Cookies | extract `headers`, `cookies` | custom key-value pairs | playwright context, httpx |
| Webhook Delivery | async `callback_url` | url, events | express, fastapi, svix |
| Cloud Delivery | async `storage_type`, `storage_url` | s3/gs, compress, custom name | boto3, @aws-sdk/client-s3 |
| Session Persistence | extract `session` | id, timeout, retry | playwright BrowserContext |
| Advanced Options | extract `referrer_type`, `device`, `http2`, `session`, `tag` | multiple | playwright, puppeteer flags |

---

## Coverage Notes

- **totalUrls:** 116 (from nimble.urls.json)
- **deepReadCount:** 30 (all pre-selected pages)
  - 28 pages fully read inline
  - 2 pages (serp SDK + parsing-schema) read via file sampling due to response size; key sections captured
- Remaining 86 URLs categorized from path + title heuristics only (not scraped)
- Blocked domains list (70+ entries) common across Extract and Proxy — not itemized above but noted: paypal.com, stripe.com, spotify.com, gaming platforms, etc. are explicitly blocked
