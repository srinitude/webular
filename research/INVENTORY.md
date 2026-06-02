# webular — Unified Web-Capability Inventory

**Single source of truth** for the webular build. This catalogs **every unique web-related feature** across the 7 web-data products studied, de-duplicated and grouped by **capability domain**. Each canonical feature notes which product(s) offer it and the union of key parameters.

Products surveyed (feature counts as cataloged):
| Slug | Product | Features |
|------|---------|----------|
| firecrawl | Firecrawl | 30 |
| exa | Exa | 24 |
| perplexity | Perplexity | 33 |
| tavily | Tavily | 22 |
| parallel | Parallel | 19 |
| nimble | Nimble | 20 |
| brave | Brave Search API | 15 |

**Capability domains:** SEARCH · SCRAPE · CRAWL · MAP · EXTRACT · SUMMARIZE/ANSWER · RESEARCH/CONTEXT · PARSE/TRANSFORM · MEDIA · MONITOR/CHANGE-TRACKING · PROXY/STEALTH · BATCH/ASYNC.

Legend for product coverage: ✅ first-class · �I via-inline-option · ◔ partial/adjacent.

---

## Domain coverage matrix (which product does what)

| Capability domain | Firecrawl | Exa | Perplexity | Tavily | Parallel | Nimble | Brave |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| SEARCH (web/news/etc.) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SCRAPE (single URL → clean content) | ✅ | ✅ | ✅(fetch) | ✅(extract) | ✅(extract) | ✅(extract) | ◔(llm-context) |
| CRAWL (recursive site) | ✅ | ◔(subpages) | — | ✅ | ◔ | ✅ | — |
| MAP (URL discovery only) | ✅ | — | — | ✅ | — | ✅ | — |
| EXTRACT (structured/schema) | ✅ | ✅ | ◔(json) | ◔ | ✅ | ✅(CSS) | — |
| SUMMARIZE / ANSWER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RESEARCH / agentic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◔(research mode) |
| PARSE / TRANSFORM (docs, md) | ✅ | ◔ | ✅(file) | ◔ | ◔ | ✅ | — |
| MEDIA (screenshot/pdf/img/video) | ✅ | ◔(imgs) | ✅(img/video) | ◔(imgs) | — | ✅ | ✅(img/video) |
| MONITOR / CHANGE-TRACKING | ✅ | ✅ | — | — | ✅ | ◔ | — |
| PROXY / STEALTH / GEO | ✅ | ◔(livecrawl) | — | ◔(keyless) | ◔(source) | ✅ | ◔(geo) |
| BATCH / ASYNC / WEBHOOKS | ✅ | ✅ | ✅(async) | ◔ | ✅ | ✅ | — |

---

# 1. SEARCH

Web/news/image/video/specialized search returning ranked results, optionally with inline scraped content.

### 1.1 Web search (core ranked results)
- **Products:** Firecrawl (`/v2/search`), Exa (`/search`), Perplexity (`/search`), Tavily (`/search`), Parallel (`/v1/search`), Nimble (`/v1/search`, `/v1/serp`), Brave (`/web/search`).
- **Canonical params (union):**
  - `query` (string; Perplexity & Parallel also accept **array** for multi-query; Parallel requires `objective` + 2–5 keyword `search_queries`)
  - `limit` / `max_results` / `count` / `numResults` (1–100; Brave web max 20, news max 50)
  - `offset` (Brave 0-based, max 9; Nimble `start`)
  - result-type `sources` / `topic` / `category` (web | news | images | videos | finance; Firecrawl categories: github, research, pdf)
  - `includeDomains` / `excludeDomains` / `search_domain_filter` / `select_domains` (allow/deny; `-`-prefix denylist in Perplexity; TLD filters `.gov`/`.edu`; up to 300 Tavily / 1200 Exa / 200 Parallel)
  - time/recency: `tbs` (Firecrawl Google-style `qdr:*`), `freshness` (Brave `pd/pw/pm/py` or date-range), `time_range` (Tavily day/week/month/year), `search_recency_filter` (Perplexity), `start_date`/`end_date` / `startPublishedDate`/`endPublishedDate` / `search_after_date_filter` / `after_date`
  - geo: `location`/`country`/`userLocation`/`user_location{country,region,city,lat,long}` (ISO 3166-1 alpha-2)
  - language: `search_lang` / `search_language_filter` (ISO 639-1)
  - `safesearch` / `safe_search` / `moderation` (off|moderate|strict)
  - search depth/quality: Exa `type` (auto/instant/fast/deep-lite/deep/deep-reasoning), Tavily `search_depth` (ultra-fast/fast/basic/advanced), Nimble `search_depth` (lite/fast/deep), Parallel `mode` (basic/advanced), Perplexity `search_context_size` (low/medium/high) + `search_type` (fast/pro/auto)
  - content attach: `scrapeOptions` (Firecrawl), `include_raw_content` (Tavily), `contents` (Exa), `chunks_per_source` (Tavily reranked snippets), `max_tokens`/`max_tokens_per_page` (Perplexity/Nimble per-result token budget)
  - `include_answer` (Tavily/Nimble inline LLM answer), `include_images`, `include_favicon`
  - `auto_parameters` (Tavily auto-pick depth/topic/time), `exact_match` (Tavily verbatim)
- **Response (union):** `results[]{title,url,description/content/snippet,score,publishedDate,author,favicon,raw_content,images}`, optional `answer`, `images[]`, `usage`, `request_id`.

### 1.2 News search
- **Products:** Exa (`category:news`), Tavily (`topic:news`), Brave (`/news/search`), Nimble (`search_engine:google_news`), Firecrawl (`sources:["news"]`), Perplexity (search results).
- Params: same as web + `freshness`/`time_range`, higher `count` cap (Brave 50).

### 1.3 Image search
- **Products:** Brave (`/images/search`, count up to 200, proxied 500px thumbs), Perplexity (`return_images`+`image_domain_filter`+`image_format_filter`), Firecrawl (`sources:["images"]`), Tavily (`include_images`+`include_image_descriptions`), Nimble (`google_images`).

### 1.4 Video search
- **Products:** Brave (`/videos/search`), Perplexity (`media_response.overrides.return_videos`).

### 1.5 Specialized / vertical search
- **Exa categories:** company (50M+, structured `entities[]`: founded, HQ, workforce, financials, webTraffic), people (1B+, work/education history), research paper (100M+), financial report (SEC/Yahoo), code (GitHub/SO/docs), personal site, pdf.
- **Perplexity modes:** academic (`search_mode:academic`), SEC (`search_mode:sec`), finance_search tool, people_search tool.
- **Parallel FindAll:** entity discovery (companies/people) with `match_conditions[]` — see RESEARCH §7.6.
- **Nimble focus modes:** general/news/coding/academic/shopping/social/geo/location + custom Web Search Agents.
- **Brave place/POI search:** `/local/place_search`, `/local/pois`, `/local/descriptions` (200M+ places, lat/long/radius, ratings/hours/photos).

### 1.6 Find-similar (semantic neighbors)
- **Products:** Exa (`/findSimilar`, deprecated → search with descriptive query; `excludeSourceDomain`).

### 1.7 Query aids (Brave-unique)
- **Autosuggest** (`/suggest/search`, `rich` entity metadata), **Spellcheck** (`/spellcheck/search`).

### 1.8 Custom ranking / operators (Brave-unique)
- **Goggles** DSL (`$boost`/`$downrank`/`$discard`, `site=`/path/wildcards; max 3 per request) on web/news/llm-context.
- **Search operators** in `q`: `ext:`, `filetype:`, `intitle:`, `inbody:`, `inpage:`, `lang:`, `loc:`, `site:`, `+`/`-`/`""`, `AND`/`OR`/`NOT`.

### 1.9 Rich data verticals (Brave-unique)
- `enable_rich_callback` → calculator, definitions, unit/currency conversion, unix timestamp, package tracking, stocks, crypto, weather, sports.

---

# 2. SCRAPE (single-URL → clean content)

Fetch one URL (JS-rendered or static) and return clean Markdown/HTML/structured content.

### 2.1 Single-page scrape
- **Products:** Firecrawl (`/v2/scrape`), Exa (`/contents`), Tavily (`/extract`), Parallel (`/v1/extract`), Nimble (`/v1/extract`), Perplexity (`fetch_url` tool), Brave (`/llm/context` adjacent).
- **Canonical params (union):**
  - `url` / `urls` (Exa/Tavily/Parallel/Nimble accept arrays up to 20–100; Perplexity `max_urls` 1–10)
  - output `formats` (markdown | html | rawHtml | links | images | screenshot | summary | json | branding | audio | video | changeTracking | attributes | query | highlights); `format` (markdown/text — Tavily/Parallel/Nimble); `output_format` (plain_text/markdown/simplified_html — Nimble)
  - `onlyMainContent` (strip boilerplate), `includeTags`/`excludeTags` (CSS selectors), `removeBase64Images`
  - JS render: `waitFor` (ms), `render`+`driver` (Nimble vx6/vx8/vx8-pro/vx10/vx10-pro), `extract_depth` (Tavily basic/advanced), `render_options{render_type:load/domready/idle0/idle2, timeout, include_iframes, blocked_domains, disabled_resources}`
  - cache/freshness: `maxAge`/`maxAgeHours`/`max_age_seconds`/`minAge` (0=always fresh, -1/`lockdown`=cache-only), `storeInCache`, `livecrawlTimeout`, `fetch_policy{max_age_seconds,timeout_seconds,disable_cache_fallback}`
  - `timeout` (ms/s)
  - device/viewport: `mobile`, `device` (desktop/mobile/tablet), `location{country,languages}`, `locale`
  - proxy/stealth: `proxy` (basic/enhanced/auto), `driver` stealth, `referrer_type`, geo (see §11)
  - request control: `headers`, `cookies`, `method`, `http2`, `is_xhr`, `skipTlsVerification`, `expected_status_codes`
  - content focus: `objective`+`search_queries` (Parallel — focus excerpts), `query` (Tavily/Exa — rerank chunks/highlights), `chunks_per_source`, `max_chars_total`/`max_chars_per_result`, `verbosity` (Exa compact/standard/full), `includeSections`/`excludeSections` (Exa header/nav/body/footer)
  - persistence/session: `profile{name,saveChanges}` (Firecrawl), `session{id,timeout,retry,prefetch_userbrowser}` (Nimble)
  - compliance: `zeroDataRetention`, `redactPII`, `lockdown`, `compliance:hipaa` (Exa)
- **Response (union):** `markdown/raw_content/text`, `html`, `links[]`, `images[]`, `metadata{title,description,language,og*,statusCode,...}`, `screenshot`, `summary`, `excerpts[]`, `full_content`, `failed_results[]`/`errors[]`.

### 2.2 Browser interaction / actions (stateful automation)
- **Products:** Firecrawl (`/scrape/{id}/interact` — NL prompt | Playwright code | bash; `actions[]`: wait/click/write/press/scroll/screenshot/scrape/executeJavascript/pdf; `liveViewUrl`), Nimble (`browser_actions[]`: goto/wait/wait_for_element/click/press/fill/scroll/auto_scroll/screenshot/get_cookies/fetch).
- Params: `prompt`/`code`/`language`(node/python/bash), `timeout`, per-action selectors/coords/timeouts; Nimble `auto_scroll{max_duration,idle_timeout,step_size}`, `required:false` optional steps.

### 2.3 Network capture (API interception — Nimble-unique)
- `network_capture[]{method, url{type:exact/contains/regex,value}, resource_type:xhr/fetch/...}` → records background API responses.

### 2.4 Brand identity extraction (Firecrawl-unique)
- `formats:["branding"]` → colors, fonts, typography, spacing, components, icons, animations, layout, personality.

### 2.5 Caching / fast-scrape, mobile emulation, lockdown, ZDR
- Firecrawl: `maxAge`/cacheState, `mobile`, `lockdown` (cache-only, `SCRAPE_LOCKDOWN_CACHE_MISS`), `zeroDataRetention`.

---

# 3. CRAWL (recursive site traversal)

Discover + scrape every reachable subpage from a root URL.

### 3.1 Recursive crawl
- **Products:** Firecrawl (`/v2/crawl`), Tavily (`/crawl`), Nimble (`/v1/crawl`), Exa (`/contents` subpages — partial), Parallel (crawler resource — partial).
- **Canonical params (union):**
  - `url` (root)
  - `limit` (max pages; Firecrawl default 10000, Tavily 50, Nimble 5000/max 10000)
  - depth: `maxDiscoveryDepth` / `max_depth` (1–20) ; breadth: `max_breadth` (Tavily 1–500)
  - path filters: `includePaths`/`excludePaths` (regex), `select_paths`/`exclude_paths` (regex), `regexOnFullURL`
  - domain scope: `crawlEntireDomain`/`crawl_entire_domain`, `allowSubdomains`/`allow_subdomains`, `allowExternalLinks`/`allow_external`/`allow_external_links`, `select_domains`/`exclude_domains`
  - sitemap: `sitemap` (include/skip/only)
  - dedup: `ignoreQueryParameters`/`ignore_query_parameters`
  - politeness: `delay`, `maxConcurrency`, `ignoreRobotsTxt`+`robotsUserAgent` (enterprise)
  - per-page scrape: `scrapeOptions` / `extract_options` / `extract_depth` (full scrape config applied per page)
  - semantic guidance: `instructions` (Tavily NL filter — doubles cost), `prompt` (Firecrawl NL→params; `params-preview`)
  - async: `webhook`/`callback{url,headers,metadata,events:[started,page,completed,failed]}`
- **Async lifecycle:** `startCrawl`→`getCrawlStatus(id)`→`watcher` (Firecrawl WebSocket); Nimble `crawl.run/status/list/terminate`; status `{total,pending,completed,failed,tasks[]}`.
- **CLI extra:** Tavily `--output-dir` saves each page as `.md`.

---

# 4. MAP (URL discovery only)

Fast list of URLs for a domain — no content scraping.

### 4.1 Site map
- **Products:** Firecrawl (`/v2/map`), Tavily (`/map`), Nimble (`/v1/map`).
- **Canonical params (union):**
  - `url`
  - `search` (Firecrawl — filter+rank URLs by text)
  - `limit` (Firecrawl up to 100,000 / flat 1 credit; Nimble 1–100,000; Tavily 50)
  - `sitemap` (include/skip/only)
  - `includeSubdomains` / `domain_filter` (domain/subdomain/all)
  - `instructions` (Tavily NL URL filter), `select_paths`/`exclude_paths`/`select_domains`/`exclude_domains`, `max_depth`/`max_breadth`, `allow_external`
  - `location`/`country`/`locale`
- **Response:** `results`/`links[]` (string URLs, optionally `{url,title,description}`), `base_url`.

---

# 5. EXTRACT (structured / schema-driven data)

LLM- or selector-driven extraction of typed data from page(s).

### 5.1 Schema/LLM structured extraction
- **Products:** Firecrawl (`/v2/extract` multi-URL + wildcards `example.com/*`; `formats:[{type:json,schema,prompt}]` single-page), Exa (`outputSchema` on search/answer/agent; `summary.schema`), Parallel (`task_spec.output_schema` json/text/auto), Perplexity (`response_format:json_schema`), Tavily (`output_schema` on research), Nimble (parsing schema — selector-based).
- **Canonical params (union):**
  - `urls` (arrays + wildcards) | inline on scrape
  - `prompt` / `objective` (NL extraction goal)
  - `schema` / `outputSchema` / `output_schema` / `response_format.json_schema` (JSON Schema draft-07/2019-09/2020-12; Pydantic/Zod in SDKs)
  - `systemPrompt` (guide synthesis)
  - `enableWebSearch` (Firecrawl — follow links off-domain), `agent:{model:FIRE-1}` (agentic navigation)
  - schema rules (Parallel): root object, all-required (use `["string","null"]`), `additionalProperties:false`, max depth 5, max 100 props, ≤25k chars; field `description` = per-field prompt
  - `stream` (SSE when outputSchema set)
- **Async pattern:** `startExtract`/`getExtractStatus` (Firecrawl).
- **Per-field provenance (Parallel-unique):** `output.basis[]{field, citations[]{url,excerpts}, reasoning, confidence:high/medium/low}` (opt-in per-element via beta header).

### 5.2 CSS/XPath parsing schema (Nimble-unique deterministic extract)
- `parse:true` + `parser` recipe; parser types: terminal | terminal_list | schema | schema_list | or | and | const; selectors: css | xpath | json-path; extractors: text | attr | json | raw; post-processors: number/date/clean.

### 5.3 Link & image extraction (extras)
- **Products:** Exa (`extras{links:N, imageLinks:N}`), Firecrawl/Nimble (`formats:["links","images"]`), Tavily/Brave (image lists).

### 5.4 Highlights (query-relevant snippets)
- **Products:** Exa (`highlights{query,maxCharacters}` + `highlightScores[]`, ~10x token efficiency), Firecrawl (`formats:[{type:highlights,query}]`).

---

# 6. SUMMARIZE / ANSWER

Synthesize prose answers or page summaries with citations.

### 6.1 Grounded answer (search → synthesize)
- **Products:** Exa (`/answer` + `streamAnswer`; `text`, `outputSchema`, `citations[]`), Perplexity (`/v1/sonar` chat completions; models sonar/sonar-pro/sonar-reasoning-pro; `citations[]`,`search_results[]`,`related_questions[]`), Tavily (`include_answer` basic/advanced), Nimble (`include_answer`), Brave (`/chat/completions` model:"brave"; streaming `<citation>`/`<enum_item>` tags; `enable_research`), Parallel (Chat API `/chat/completions` speed/lite/base/core + `basis`).
- **Canonical params (union):** `query`/`messages`, `stream` (SSE), `outputSchema`/`response_format`, `systemPrompt`/`instructions`, model selection, `search_*` filters (domain/recency/lang/geo), `return_related_questions`, `reasoning_effort` (minimal/low/medium/high), `disable_search`/`enable_search_classifier`.

### 6.2 Per-page summary
- **Products:** Firecrawl (`formats:["summary"]`), Exa (`summary{query,schema}` — Gemini Flash), Tavily/Nimble (toolkit `*_and_summarize`).

### 6.3 Page query / NL Q&A about a page
- **Products:** Firecrawl (`formats:[{type:query,prompt,mode:directQuote|freeform}]` → `answer`).

### 6.4 Related questions / follow-ups
- **Products:** Perplexity (`return_related_questions`), Brave (summarizer `followups`).

### 6.5 Streaming reasoning visibility
- **Products:** Perplexity Pro Search (concise mode chunk types: `chat.reasoning`/`chat.reasoning.done`/`chat.completion.chunk`/`chat.completion.done`; `reasoning_steps[]`), Brave research mode, Tavily research SSE.

---

# 7. RESEARCH / CONTEXT (agentic, multi-step)

Autonomous search→read→reason→synthesize loops; RAG-optimized context; entity discovery; enrichment.

### 7.1 Multi-step research agent (async)
- **Products:** Firecrawl (`/v2/agent` — spark-1-mini/spark-1-pro; `prompt`,`schema`,`maxCredits`; also FIRE-1), Exa (`/agent/runs` beta — `query`,`outputSchema`,`effort:low/medium/high/xhigh/auto`,`input.data` row enrichment, `previousRunId`; deprecated `/research/v1`), Perplexity (Agent API `/v1/agent` — `preset:fast-search/pro-search/deep-research`, `tools[]`, `max_steps`, model fallback `models[]`; async `sonar-deep-research`), Tavily (`/research` — model mini/pro, `output_length`, `citation_format`; SSE tool events Planning/WebSearch/Generating/ResearchSubtopic), Parallel (Task API `/v1/tasks/runs` — processors lite→ultra8x ±`-fast`; `task_spec`, `source_policy`, `mcp_servers[]`, deep-research auto mode), Nimble (Agents — pre-built + custom Web Search Agents), Brave (Answers `enable_research`, up to 53 queries/1000 pages).
- **Canonical params (union):** `prompt`/`input`/`instructions`/`query` (NL task), `schema`/`output_schema`, effort/processor tier, `source_policy`/domain filters, `mcp_servers[]` (remote tool calling), `previous_interaction_id`/`previousRunId` (multi-turn chaining), `metadata`, `webhook`, `enable_events`/`stream`.
- **Async lifecycle:** create → poll (`retrieve`/`getStatus`) → `result()`; or webhook; or SSE events; terminal states completed/failed/cancelled; stop reasons schema_satisfied/budget_reached.
- **Result transparency:** `output.basis[]` (Parallel per-field citations+confidence), `output.grounding[]` (Exa per-field citations), markdown report + inline citations.

### 7.2 RAG-optimized context (machine-first)
- **Products:** Brave (`/llm/context` — pre-chunked relevance-ranked snippets; token budgets: `maximum_number_of_tokens` 1024–32768, `_per_url`, `_snippets`, `context_threshold_mode` strict/balanced/lenient; `grounding{generic,poi,map}`, `sources{}`), Exa (highlights/summary for RAG), Parallel/Tavily (`search_and_answer`, `crawl_and_summarize`, `extract_and_summarize` toolkit).

### 7.3 Data enrichment (entity → fields)
- **Products:** Parallel (Task API row-by-row + Task Groups), Exa (Agent `input.data` + Websets enrichment columns), Firecrawl (fire-enrich pattern).

### 7.4 Multi-turn / conversation chaining
- **Products:** Parallel (`previous_interaction_id`↔`interaction_id`), Exa (`previousRunId`), Perplexity (messages history), Brave (chat).

### 7.5 Schema-from-NL (ingest / suggest)
- **Products:** Parallel (`/tasks/suggest` NL→input/output schema, `/tasks/suggest-processor` recommend tier), Exa/Firecrawl (implicit via prompt).

### 7.6 Entity discovery / list-building
- **Products:** Parallel FindAll (`/findall/runs` — `objective`,`entity_type`,`match_conditions[]{name,description}`,`generator:preview/base/core/pro`,`match_limit:5–1000`,`exclude_list[]`; Generate→Evaluate→Enrich pipeline; SSE+webhook events), Exa Websets (`/websets` + searches + enrichments + imports + monitors + exports + webhooks; CSV import/export, dashboard).

### 7.7 MCP tool-calling inside research
- **Products:** Parallel (`mcp_servers[]{type:url,url,name,headers,allowed_tools}`, ≤10), Perplexity (Agent `tools[]`: web_search/finance_search/people_search/fetch_url/FunctionTool).

---

# 8. PARSE / TRANSFORM (documents, formats, markdown)

Convert documents/files and transform HTML→Markdown/structured.

### 8.1 Document parsing (PDF/DOCX/XLSX → md/json)
- **Products:** Firecrawl (`/v2/parse` — file upload up to 50 MB; formats html/htm/pdf/docx/doc/odt/rtf/xlsx/xls; `parsers:[{type:pdf,mode:fast/auto/ocr,maxPages}]`), Perplexity (file_url input — pdf/doc/docx/txt/rtf, 50 MB, 30 files), Parallel/Nimble/Exa (scrape auto-detects PDF), Tavily (PDF via extract).
- Params: `file`/`file_url`, `formats`, `onlyMainContent`, `parsers` (PDF fast/auto/ocr), `timeout`.

### 8.2 HTML→Markdown / content cleaning
- **Products:** all (markdown output format); Firecrawl `onlyMainContent`, Nimble `output_format`, Tavily/Parallel `format`.

### 8.3 Content-type filtering
- **Products:** Nimble (`content_type`: pdf/docx/xlsx/pptx or groups documents/spreadsheets/presentations), Brave/Perplexity (`filetype:`/`ext:` operators).

---

# 9. MEDIA (screenshot / pdf / audio / video / images)

### 9.1 Screenshot
- **Products:** Firecrawl (`formats:[{type:screenshot,fullPage,quality,viewport}]`, max 7680×4320, expires 24h), Nimble (`formats:["screenshot"]` base64 PNG; browser action screenshot PNG/JPEG/WEBP).

### 9.2 PDF generation (page → PDF)
- **Products:** Firecrawl (browser action `pdf`).

### 9.3 Audio / video extraction (from media pages)
- **Products:** Firecrawl (`formats:["audio"]`/`["video"]` — signed GCS URL from YouTube etc., expires 1h, 5 credits).

### 9.4 Media download (through proxy)
- **Products:** Nimble (`/v1/media` sync/async — `url`,`country`,`expected_mime_types` wildcards; binary response).

### 9.5 Image/video results (in search) — see §1.3/§1.4.

---

# 10. MONITOR / CHANGE-TRACKING

Scheduled re-checks, diffing, and alerting on web changes.

### 10.1 Change tracking (diff vs previous snapshot)
- **Products:** Firecrawl (`formats:[{type:changeTracking,modes:[git-diff,json],tag,schema,prompt}]` → `changeStatus:new/same/changed/removed`, `diff.text`, `diff.json`, `visibility`).

### 10.2 Scheduled monitors
- **Products:** Firecrawl (`/v2/monitor/*` — scrape|crawl target; `schedule{cron|text,timezone}` min 15min; `goal`+`judgeEnabled` LLM meaningfulness; `targets[1–50]`; `webhook`+`notification.email{includeDiffs}`; `retentionDays`), Exa (`/monitors` — `trigger{type:interval,period:6h/1d/7d}`, `search` config, semantic dedup across runs, `webhook`, `outputSchema`, status active/paused/disabled), Parallel (`/monitors` — `type:event_stream|snapshot`, `frequency:1h/6h/1d/1w/30d`, `settings.query`, `output_schema` flat 3–5 fields, webhook, `/trigger`).
- **Canonical params (union):** `name`, schedule (cron or interval/text), target (search query | scrape URL | crawl | task snapshot), `goal`/`output_schema`, `webhook{url,headers,events}`, email notification, dedup, retention, manual `trigger`/`run`, list-checks/events.
- **Events:** `monitor.page`/`monitor.check.completed` (Firecrawl), `monitor.event.detected` (Parallel), webhook delivery (Exa).

---

# 11. PROXY / STEALTH / GEO

Routing, anti-bot evasion, geo-targeting, compliance.

### 11.1 Proxy tiers / stealth
- **Products:** Firecrawl (`proxy`: basic/enhanced/auto with auto-retry), Nimble (residential network `ip.nimbleway.com:7000`; drivers vx10/vx10-pro stealth; `os`/`browser`/`device` emulation), Tavily (`puppeteer-extra` adjacent), Exa (livecrawl).

### 11.2 Geo-targeting
- **Products:** Nimble (`country`/`state`/`city`/`locale` via residential exit; sticky `session-{id}`, `geosession-{id}`), Firecrawl (`location.country`), Brave (`X-Loc-*` headers + `country`), most (`country`/`location`/`userLocation`).

### 11.3 Custom headers / cookies / sessions
- **Products:** Nimble (`headers`,`cookies`,`session`), Firecrawl (`headers`, `profile`), all (custom `headers`).

### 11.4 Compliance / data retention
- **Products:** Firecrawl (`zeroDataRetention`, `lockdown`, `redactPII`, ZDR/anon search tiers), Exa (`compliance:hipaa`), Tavily/Parallel (keyless/x402 payment — no-account modes).

### 11.5 Keyless / machine-payment access
- **Products:** Tavily (`X-Tavily-Access-Mode:keyless`; x402 USDC-on-Base per-request), Parallel (free MCP, no account).

---

# 12. BATCH / ASYNC / WEBHOOKS / STREAMING

Concurrent multi-target jobs, async polling, callbacks, real-time progress.

### 12.1 Batch scrape / multi-URL
- **Products:** Firecrawl (`/v2/batch/scrape` — `urls[]`, `maxConcurrency`, webhook events), Exa/Tavily/Parallel/Nimble (multi-URL extract up to 20–100; Nimble `/extract/batch` up to 1000 + `shared_inputs`).

### 12.2 Batch / task groups (research at scale)
- **Products:** Parallel (Task Groups `/tasks/groups` — `default_task_spec`, `inputs[]` up to 1000/POST, aggregate status, SSE), Nimble (`/agents/batch`, `/serp/batch`, `/extract/batch`), Exa (Websets batch).

### 12.3 Async submit/poll
- **Products:** Perplexity (`/async/sonar` + GET, `idempotency_key`, CREATED→IN_PROGRESS→COMPLETED/FAILED), Nimble (`*/async` + `/tasks/{id}`/`/tasks/{id}/results`, states pending/in_progress/success/error), Exa/Parallel/Tavily/Firecrawl (job-id + poll pattern).

### 12.4 Webhooks (completion callbacks)
- **Products:** Firecrawl (HMAC-SHA256 `X-Firecrawl-Signature`; crawl/batch/monitor/agent events), Parallel (`webhook{url,event_types}`, HMAC `webhook-signature`), Exa (Websets webhooks + signature verification), Nimble (`callback_url`/`callback{url,headers,metadata,events}`).
- Common: notification-not-data (still call `/result`), HMAC verification, event types.

### 12.5 SSE / streaming progress
- **Products:** Perplexity (Sonar/Agent SSE event types), Parallel (`/tasks/runs/{id}/events` — `task_run.state`/`progress_msg`/`progress_stats{num_sources_read}`; FindAll resumable via `event_id`), Tavily (research SSE 5 event types), Exa (`stream`), Firecrawl (crawl WebSocket `watcher`).

### 12.6 Cloud-storage delivery (Nimble-unique)
- `storage_type:s3/gs`, `storage_url`, `storage_compress`, `storage_object_name`.

### 12.7 MCP server exposure (all major)
- Every product ships an official MCP server exposing search/scrape/extract/etc. as MCP tools (Firecrawl, Exa, Perplexity, Tavily, Parallel, Nimble, Brave).

### 12.8 SDK / CLI surface
- All ship Python + TypeScript SDKs (Firecrawl also Go/Rust/Java/PHP; Parallel/Nimble Go); Tavily + Nimble + Parallel + Brave ship CLIs; all ship Agent Skills.

---

## De-duplicated canonical feature count

**~62 unique web capabilities** across the 12 domains (counting each numbered sub-feature once after de-duplication across the 7 products). This is the catalog the webular CLI command surface (see structured return / REPOS.md / FOSS.md) is built to cover with FOSS building blocks composed as Mastra non-model tools and workflows.
