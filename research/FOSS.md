# webular — FOSS Building Blocks

For **each canonical capability** in `INVENTORY.md`, the **best free & open-source libraries** to implement it **without any paid API**. These are webular's building blocks, to be composed as **Mastra non-model tools and workflows**. Bun is the runtime; preference order is: **Bun built-ins → npm (FOSS) → vendored Rust/wasm → Python (pypi) fallback**.

Library availability tiers in research caches:
- **opensrc cache** = already fetched into `/Users/kiren/.opensrc/repos/...` (see `REPOS.md`) — Firecrawl's own Rust libs are the standout reusable assets.
- **npm/pypi/cargo** = pull on demand.

---

## 0. Framework foundations (the spine)

These are NOT replaced — webular is built **on** them.

### Mastra (`@mastra/core`) — orchestration + tool/agent runtime
- `createTool({ id, inputSchema, outputSchema, execute })` — every webular capability is a **non-model tool** whose `execute` runs FOSS code (fetch/parse/crawl). Tools stream via `context.writer`.
- `createWorkflow` + `createStep` — typed DAG: `.then()` · `.parallel()` · `.foreach(step,{concurrency})` (URL fan-out) · `.branch([[cond,step]])` · `.map()` · `.dowhile`/`.dountil` (pagination/retry loops) · `.sleep`/`.sleepUntil` (rate-limit cooldown) · `.commit()`.
- Run control: `createRun` → `run.start` / `run.stream` / `run.startAsync` (fire-and-forget crawl jobs) / `run.resume` (HITL) / `run.timeTravel` (retry-from-step) / `run.cancel` (AbortSignal).
- Shared typed `stateSchema` + `setState` (track `pagesVisited`/`rateLimitHits`/`totalBytes` across a crawl); durable suspend/resume snapshots (libSQL/pg).
- Scheduled workflows (`schedule:{cron,timezone}`) → monitors; built-in scheduler needs long-lived process, else `@mastra/inngest`.
- Agents (`new Agent({model,tools})`, `.generate`/`.stream`) for the summarize/answer/research steps; local model via `ollama`. Processors (TokenLimiter, ToolCallFilter, ModerationProcessor, ResponseCache) for pipeline hygiene.
- `MCPClient`/`MCPServer` — expose webular as MCP and consume external MCP tools.
- Hono HTTP server + `registerApiRoute` (webhook receivers for crawl callbacks); `RequestContext` (per-request tiers/keys).
- `MDocument.fromHTML/fromPDF/fromMarkdown` + `.chunk()` and `@mastra/rag` for RAG-context capability; vector stores `@mastra/pg`(pgvector)/`@mastra/chroma`/`@mastra/lance`/`@mastra/duckdb` (all FOSS self-host).

### Bun — runtime primitives
- `Bun.fetch()` — HTTP client; `proxy:{url,headers}` (CONNECT proxy), `unix`, `tls`, `decompress`, `signal:AbortSignal.timeout(ms)`, `fetch.preconnect`, `dns.prefetch` → **scrape/crawl fetch layer + proxy support**.
- **`HTMLRewriter`** (Cloudflare lol-html) — streaming CSS-selector HTML transform → **link extraction, content cleaning, metadata, attribute extraction, deterministic parse** (zero-dependency alternative to cheerio for streaming).
- `$` shell — invoke `mmdc`, `yt-dlp`, external CLIs injection-safe.
- `bun:sqlite` — local cache / URL queue / crawl-state / change-tracking snapshots (3–6x better-sqlite3).
- `Bun.redis`, `Bun.s3`, `Bun.S3Client` — distributed queue/cache + cloud-storage delivery (S3/R2/GCS/MinIO).
- `Worker` (`smol:true`) — parallelize crawl/scrape across cores.
- SSE via async-generator `new Response(async function*(){ yield "data: ...\n\n" })` + `server.timeout(req,0)` → **streaming progress**.
- `bun build --compile --target=bun-<os>-<arch>` — ship webular as a **single self-contained binary**.
- `Bun.secrets` (OS keychain), `Bun.CSRF`, `crypto.createHmac` (webhook HMAC-SHA256 verify).

### Mermaid — diagram generation
- `@mermaid-js/mermaid-cli` (`mmdc`) — `mmdc -i in.mmd -o out.svg` via `Bun.$`; SVG (no Chromium for SVG in v11+), PNG/PDF fallback via Playwright. Use for the 7 webular architecture diagrams. `mermaid.parse()` to validate DSL; `deterministicIds:true` + `deterministicIDSeed:"webular"` for cache-stable output.

### mise — task orchestration / dev env
- TOML tasks with `depends`/`depends_post`/`wait_for` DAG, `sources`/`outputs` freshness (skip-if-unchanged scrape), `mise watch` (watchexec) for live pipelines, usage-spec typed CLI args, Tera templates, `[env]`+secrets (age/SOPS) for API keys, `mise tasks deps --dot` → graphviz, sandboxed `mise exec --deny-net/--allow-net`. Webular ships a `mise.toml` task surface mirroring its CLI subcommands.

---

## 1. SEARCH

| Sub-capability | Best FOSS (npm-first for Bun) | Notes |
|---|---|---|
| **Web search (no key)** | `duck-duck-scrape` (npm) / `duckduckgo-search` (pypi); **SearXNG** (self-host, Docker) REST API | SearXNG is the strongest — aggregates 70+ engines, supports `site:`/`filetype:`/`intitle:`/`lang:`/`time_range`, no rate limits. Brave free tier (2000/mo) as a keyed fallback. |
| News search | `rss-parser` (npm), `gnews`/`pygooglenews`/`feedparser` (pypi), GDELT free | RSS + Google News RSS; SearXNG news category. |
| Image search | `duckduckgo-search` `ddg_images()`, `icrawler` (pypi); Unsplash/Pexels free tier | DDG image API + Playwright SERP scrape fallback. |
| Video search | `yt-dlp` (metadata), `youtube-search-python` (pypi); YouTube Data API free quota | yt-dlp covers 1000+ sites incl. metadata + transcript (`youtube_transcript_api`). |
| Specialized: research papers | `arxiv`, `semanticscholar`, `scholarly`, `unpaywall` (pypi); OpenAlex API (fully free), CORE, PubMed E-utilities | OpenAlex + Semantic Scholar are best free academic. |
| Specialized: finance | `yahoo-finance2` (npm), `yfinance`/`yahooquery`/`openbb-platform` (pypi); Alpha Vantage free | |
| Specialized: SEC filings | SEC EDGAR Full-Text Search API (free, no key); `edgar` (npm)/`sec-edgar-downloader` (pypi) | |
| Specialized: company/people | OpenCorporates free tier; (people are TOS-restricted — no clean FOSS) | Exa's enriched entities have **no free equivalent**. |
| Specialized: code search | GitHub Search API (free), `grep.app`, Sourcegraph (self-host OSS) | |
| Place / POI / geo | **Overpass API (OpenStreetMap)** + `overpy`; `nominatim` (geocode, self-host); `geopy` | Overpass = free unlimited POI by category+bbox. |
| Query autosuggest | Wikipedia OpenSearch API; DDG `ac/` / Google `complete/search` (undocumented public) | |
| Spellcheck | `nspell`/`typo.js` (npm, Hunspell), `symspellpy`/`pyspellchecker` (pypi); LanguageTool (self-host) | |
| Custom ranking (Goggles) | self-crawled index in `meilisearch`/`typesense`/`elasticsearch` with boost queries; `whoosh` (pypi) | Replicate Goggles via post-rank rules. |
| Relevance re-ranking | `@xenova/transformers` (npm, cross-encoders) / `sentence-transformers` + `FlagEmbedding` (pypi) | ms-marco cross-encoder for snippet reranking. |
| Rich verticals (weather/crypto/...) | `open-meteo` (free weather), `pycoingecko` (crypto), `mathjs`/`sympy`, exchangerate-api free | Brave bundles these; webular composes per-vertical free APIs. |

---

## 2. SCRAPE

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| HTTP fetch (static) | **`Bun.fetch`**; `undici`/`got` (npm); `httpx`/`aiohttp` (pypi) | `got` adds retry/proxy/streams. |
| JS rendering / headless | **`playwright`** (npm/pypi); `puppeteer`; `rebrowser-patches` | Playwright = primary render engine; `browser.newContext(devices['iPhone 14'])` for mobile emulation. |
| HTML parse / selectors | **`Bun.HTMLRewriter`** (streaming, built-in); `cheerio` (npm); `selectolax`/`lxml`/`beautifulsoup4` (pypi) | HTMLRewriter for streaming; cheerio for jQuery-style. |
| Main-content extraction (readability) | **`@mozilla/readability`** + `linkedom`/`jsdom` (npm); **`trafilatura`** (pypi, very accurate); `@postlight/parser`, `unfluff`, `goose3`, `newspaper4k` | trafilatura is the accuracy leader; readability is pure-JS. Firecrawl's own `html-extractor` (Rust, in opensrc cache) is page-type-aware. |
| HTML → Markdown | **`turndown`** (+`turndown-plugin-gfm`) (npm); `node-html-markdown`; `markdownify`/`html2text` (pypi); **`firecrawl/simd-html-to-md`** (Rust, opensrc) | |
| Browser actions / automation | `playwright` Page API (click/fill/scroll/screenshot/waitForSelector); `puppeteer` | NL-driven automation: pair Playwright with local LLM, or `@vercel-labs/agent-browser` accessibility-tree CLI. |
| Network capture (XHR intercept) | `playwright` `page.route()`/`page.on('response')`; `puppeteer` `setRequestInterception`; `mitmproxy` (pypi) | |
| Brand identity extraction | `color-thief`/`culori` (npm, colors) + `fontfaceobserver` + CSS parse via HTMLRewriter | No single lib — compose colors+fonts+layout. |
| Caching / freshness | `lru-cache`/`node-cache` (npm), `bun:sqlite`, `Bun.redis`; `hishel`/`requests-cache`/`diskcache` (pypi) | `maxAge`/cache-only/lockdown semantics via SQLite+TTL. |
| Stealth / anti-bot | `playwright-extra`+`puppeteer-extra-plugin-stealth` (npm), `cloudscraper`/`undetected-chromedriver`/`botasaurus` (pypi) | Residential proxies have **no free FOSS** — datacenter/Tor only. |

---

## 3. CRAWL

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| BFS/DFS crawl framework | **`crawlee`** (npm — Playwright/Cheerio crawlers, RequestQueue, concurrency, robots.txt, sitemaps); `simplecrawler`/`node-crawler` (npm); `scrapy`/`crawl4ai` (pypi); `colly` (Go) | crawlee is the canonical choice; or Mastra `.foreach(step,{concurrency})` + URL queue + `Bun.fetch` + HTMLRewriter link extraction. |
| robots.txt | `robots-parser`/`robots-txt-guard` (npm); `urllib.robotparser`/`reppy` (pypi) | |
| Concurrency control | `p-limit`/`p-queue`/`bottleneck` (npm); Bun `Worker` pool | Mastra `.foreach` concurrency is native. |
| URL dedup | JS `Set`, normalized-URL hash in `bun:sqlite` | |

---

## 4. MAP

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Sitemap parse | `sitemapper`/`sitemap-parser`/`sitemap-stream-parser` (npm); `ultimate-sitemap-parser`(`usp`)/`advertools` (pypi) | Handles sitemap index trees. |
| Link-only discovery BFS | `Bun.HTMLRewriter` `on("a[href]")` + queue; `crawlee` enqueueLinks; `cheerio` | Map = crawl without content fetch. |
| robots.txt sitemap hint | `robots-parser` (npm) | Discover sitemaps from robots.txt. |

---

## 5. EXTRACT

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Schema/LLM structured extraction | local LLM (`ollama` llama3/qwen) + **`instructor`**/`outlines`/`marvin`/`kor`/`jsonformer` (pypi); `zod`+`zodResponseFormat` / Mastra `structuredOutput.schema` (npm) | Mastra agent with `structuredOutput` is the native path; `instructor` for Python. `json-repair`/`jsonrepair` for malformed output. |
| CSS/XPath deterministic extract | **`Bun.HTMLRewriter`**; `cheerio`/`css-select`/`node-html-parser` (npm); `parsel`/`cssselect`/`lxml` (pypi) | Replicates Nimble parsing-schema recipes (terminal/list/schema/or/and). |
| Link & image extraction | `Bun.HTMLRewriter` `on("a[href]")`/`on("img[src]")`; `cheerio` | |
| Highlights (query snippets) | `rank_bm25`/`sentence-transformers`/`lexrank` (pypi); `@xenova/transformers` (npm) | BM25 or embedding cosine over sentence windows ≈ Exa highlights. |
| Schema validation | `zod`/`valibot`/`arktype`/`ajv` (npm); `pydantic`/`jsonschema` (pypi) | Mastra accepts all three TS schema libs. |

---

## 6. SUMMARIZE / ANSWER

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Grounded answer (search→synth) | **search (SearXNG/DDG) → fetch (trafilatura/Playwright) → synthesize (Mastra Agent + `ollama`)** pipeline | This IS webular's research workflow; `perplexica`/`gpt-researcher` are reference designs. |
| Per-page summary | `ollama` (llama3/mistral) via Mastra Agent; extractive: `sumy`/`gensim`(TextRank)/`bertopic` (pypi), `transformers` BART/PEGASUS | Extractive (sumy) needs no LLM. |
| Page Q&A | RAG: chunk→embed→retrieve→generate (`@mastra/rag`+pgvector+ollama); `haystack`/`transformers` extractive QA (pypi) | |
| Citation parsing | regex `\[(\d+)\]` + map to `search_results[].id`; never let model emit URLs | |
| Streaming reasoning | Mastra `agent.stream().fullStream` (text-delta/tool-call/reasoning-delta chunks); `eventsource-parser` (npm) | |

---

## 7. RESEARCH / CONTEXT

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Multi-step research agent | **Mastra workflow + Agent loop** (search→read→reason→synthesize with `.dowhile`); reference: `gpt-researcher`, `storm` (stanford-oval), `open-deep-research` (dzhng), `perplexica` | Build natively on Mastra; these projects are blueprints. Firecrawl's `firesearch`/`open-researcher`/`web-agent` (opensrc cache) are TS reference impls. |
| RAG-optimized context | `@mastra/rag` `MDocument.chunk()` + embeddings + vector store; `langchain` splitters | Replicates Brave llm-context: chunk + rank + token-budget. |
| Embeddings (local) | **`@xenova/transformers`** (npm, ONNX all-MiniLM/BGE); `fastembed`/`fastembed-js`; `ollama` (nomic-embed-text/mxbai-embed-large); `node-llama-cpp` | No paid API needed. |
| Vector search (FOSS) | `@mastra/pg`+pgvector; `@mastra/lance`(LanceDB)/`@mastra/duckdb`/`@mastra/chroma`; `hnswlib-node`/`vectra` (npm, in-process); `qdrant`/`chromadb` (self-host) | LanceDB/DuckDB = embedded, no server. |
| Data enrichment | entity → search → extract → LLM field-fill (Mastra `.foreach` over rows + `structuredOutput`) | Firecrawl `fire-enrich` (opensrc) is reference. |
| Multi-turn chaining | Mastra Memory (message history, thread/resource scope) | |
| Schema-from-NL | Mastra Agent with prompt → JSON Schema; validate with `zod` | |
| Entity discovery / list-build | SearXNG/DDG generate → Mastra Agent evaluate `match_conditions` → enrich; dedup `datasketch`(MinHash)/`simhash-py` | Parallel FindAll / Exa Websets pattern; no turnkey FOSS. |
| MCP tool calling | `@modelcontextprotocol/sdk` (npm) — `MCPClient`/`MCPServer`; `mcp-server-fetch`/`-filesystem`/`-github` | Mastra `MCPClient.listTools()` for drop-in tools. |
| Per-field citations/confidence | track source URLs during scrape; LLM attribution prompt; `ragas` (pypi) faithfulness scoring | Replicate Parallel `basis[]`. |

---

## 8. PARSE / TRANSFORM

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| PDF text extract | **`firecrawl/pdf-inspector`** (Rust, opensrc — fast classify+extract); `unpdf`/`pdf-parse`/`pdfjs-dist`/`pdf2json` (npm); `pymupdf`/`pdfplumber`/`pdfminer.six` (pypi) | pdf-inspector is the standout reusable Rust lib. |
| PDF OCR | `ocrmypdf`/`pytesseract` (pypi); `tesseract.js` (npm) | For Firecrawl `mode:ocr`. |
| DOCX/ODT | `mammoth` (npm); `python-docx`/`docx2txt` (pypi) | |
| XLSX/XLS | `xlsx` (npm, SheetJS); `openpyxl`/`xlrd` (pypi) | |
| RTF | `rtf-stream-parser` (npm); `striprtf` (pypi) | |
| Unified multi-format | `unstructured` (pypi); `markitdown`/`docling` (pypi, MS/IBM) | One lib for PDF/DOCX/HTML/images→md. |
| HTML→Markdown / clean | `turndown` (npm); `sanitize-html`/`DOMPurify`; `remark`/`rehype` AST | (also §2) |
| CSV/JSON parse | `csv-parse` (npm), `Bun` JSON/`json5`/`jsonl`/`yaml`/`toml` built-ins | Bun parses these natively. |

---

## 9. MEDIA

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Screenshot | **`playwright`** `page.screenshot({fullPage,type,quality})`; `puppeteer`; CLI `npx playwright screenshot` | |
| Page → PDF | `playwright`/`puppeteer` `page.pdf()` | |
| Audio/video extract | **`yt-dlp`** (pypi/standalone, 1000+ sites, ffmpeg); `pytube` | Run via `Bun.$`. |
| Media download (proxy) | `Bun.fetch`+stream / `got` stream (npm); `gallery-dl`/`yt-dlp` (pypi); `wget`/`curl` | `expected_mime_types` filter in code. |
| Image processing/thumbnails | `sharp` (npm) | |

---

## 10. MONITOR / CHANGE-TRACKING

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Change detection (diff) | `diff`/`diff-match-patch`/`deep-diff` (npm); `deepdiff` (pypi); scrape+hash store in `bun:sqlite` | git-diff text + JSON field diff. |
| Self-hosted monitor platform | **`changedetection.io`** (Docker); `huginn`; `watchtower` | Reference designs; or build native. |
| Scheduled runs | **Mastra `schedule:{cron}`** (native); `node-cron`/`croner`/`cron-parser` (npm); mise `[[watch_files]]`/cron task | Mastra scheduled workflow is the native path; needs long-lived process (or `@mastra/inngest`). |
| LLM meaningfulness judge | Mastra Agent over diff with `structuredOutput` | Replicate Firecrawl `goal`+`judgeEnabled`. |
| Dedup across runs | `datasketch` (MinHash LSH)/`simhash-py` (pypi); URL+date bloom filter | Replicate Exa semantic monitor dedup. |
| Feed polling | `rss-parser` (npm)/`feedparser` (pypi) | |

---

## 11. PROXY / STEALTH / GEO

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Proxy support | **`Bun.fetch` `proxy:{url,headers}`** (CONNECT); `got` proxy agent; `proxy-chain`/`node-http-proxy` (npm); `mitmproxy`/`3proxy`/`dante`/`goproxy` (self-host) | Bun native proxy is the simplest. |
| Proxy rotation | `crawlee` ProxyConfiguration; `scrapy-rotating-proxies`; `free-proxy` (pypi) | Free proxy lists are unreliable. |
| Residential proxies | **No free FOSS** — Tor (`stem`) is closest but not residential | Bright Data/Oxylabs/Nimble are commercial-only. |
| Geo-targeting | proxy exit-node selection + `Accept-Language`/`location` params; Tor exit country | Limited country control without paid proxies. |
| Stealth/anti-bot | `playwright-extra`+stealth plugin; `undetected-chromedriver`/`botasaurus`/`cloudscraper` (pypi); `rebrowser-patches` | (also §2.10) |
| Compliance (ZDR/PII) | `Bun.secrets`; PII redaction via Mastra `pii-detector`/`SensitiveDataFilter` processors; regex scrub | |
| Webhook HMAC | `crypto.createHmac('sha256',...)` (built-in); `standard-webhooks`/`svix` (self-host) | |

---

## 12. BATCH / ASYNC / WEBHOOKS / STREAMING

| Sub-capability | Best FOSS | Notes |
|---|---|---|
| Concurrent batch | **Mastra `.foreach(step,{concurrency})`**; `p-map`/`p-limit`/`p-queue` (npm); `asyncio.gather` (pypi) | Native Mastra primitive. |
| Job queue | `bullmq` (npm, Redis); `@mastra/inngest`; `rq`/`celery` (pypi); `Bun.redis` queue | For durable async crawl/research jobs. |
| Async submit/poll | Mastra `run.startAsync` + `getWorkflowRunExecutionResult(runId)`; `p-retry`/`tenacity` poll loop | Native. |
| Webhooks (receive) | Mastra `registerApiRoute` (Hono); `Bun.serve` route + HMAC verify | |
| Webhooks (deliver) | `svix` (self-host); `crypto` HMAC; dev: `ngrok`/`localtunnel`/`cloudflared` | |
| SSE / streaming | **Bun async-generator Response** + `server.timeout(req,0)`; Mastra `run.stream`/`agent.stream`; `eventsource-parser`/`@microsoft/fetch-event-source` (npm) | Native. |
| Cloud-storage delivery | **`Bun.s3`/`Bun.S3Client`** (S3/R2/GCS/MinIO/B2); `@aws-sdk/client-s3`/`minio` (npm); `boto3` (pypi) | Bun native S3. |
| MCP server | `@modelcontextprotocol/sdk`; Mastra `MCPServer` | Expose webular as MCP. |
| CLI framework | mise usage-spec; `yargs`/`commander`/`citty`/`meow` (npm); Bun `Bun.argv` | citty (UnJS) pairs well with Bun. |

---

## Capabilities with NO clean FOSS equivalent (flag for the build)

These are where webular's free composition is *approximate* (document explicitly so expectations are set):

1. **Neural/embedding full-web search** (Exa) — no crawled-the-whole-web corpus. Mitigation: SearXNG + on-the-fly embedding rerank over fetched results.
2. **Pre-enriched company/people entity metadata** (Exa entities, Perplexity people_search) — TOS-restricted, no FOSS source. Mitigation: scrape + LLM extract per-entity (slower, narrower).
3. **Residential proxy networks** (Nimble, Firecrawl enhanced) — commercial only. Mitigation: datacenter proxies / Tor (lower success on protected sites).
4. **Trustless per-request crypto payment** (Tavily x402) — niche; `x402-js` lib exists but no need for webular.
5. **Independent privacy-first search index** (Brave) — replicate only via SearXNG aggregation (which proxies Google/Bing/DDG).

## Standout reusable assets already in opensrc cache

| Asset | Lang | Use in webular |
|---|---|---|
| `firecrawl/pdf-inspector` | Rust | Fast PDF classify + text extract (PARSE) |
| `firecrawl/html-extractor` | Rust (Node bindings) | Page-type-aware main-content → markdown (SCRAPE) |
| `firecrawl/simd-html-to-md` | Rust | SIMD HTML→Markdown (PARSE/TRANSFORM) |
| `firecrawl/nodesig` | Rust | HTML node signaturing (dedup/change-tracking) |
| `brave/kuchikiki` | Rust | HTML tree manipulation (alt parser) |
| `brave/adblock-rust` | Rust | Strip ads/trackers during scrape (cleaner content) |
| `firecrawl/firecrawl` (core) | TS | Reference for scrape/crawl/map/extract endpoint design |
| `firecrawl/firesearch`,`open-researcher`,`web-agent`,`fire-enrich`,`open-scouts`,`firecrawl-observer` | TS | Reference impls for research, enrichment, monitoring |
| `firecrawl/fireplexity`, Brave `perplexica`-class | TS | Reference for grounded-answer search engine |
| `mermaid-js/mermaid` + `mermaid-cli` | TS/JS | Diagram generation engine |
| `jdx/usage` | Rust | CLI usage-spec (if mirroring mise task CLI) |
