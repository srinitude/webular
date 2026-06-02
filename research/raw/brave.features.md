# Brave Search API — Feature Catalog for webular

**Source**: https://api-dashboard.search.brave.com/documentation  
**Deep-read**: 18 URLs (all pre-selected pages)  
**Total URLs in inventory**: 26  
**Generated**: 2026-06-02

---

## URL Inventory — Capability Buckets

| URL | Bucket |
|-----|--------|
| /documentation/services/web-search | search |
| /documentation/services/news-search | search |
| /documentation/services/image-search | search/media |
| /documentation/services/video-search | search/media |
| /documentation/services/suggest | search/query-aid |
| /documentation/services/spellcheck | search/query-aid |
| /documentation/services/summarizer | answer-summarize (deprecated → Answers) |
| /documentation/services/place-search | search/geo |
| /documentation/services/answers | answer-summarize |
| /documentation/services/grounding | answer-summarize (resolves to Answers page) |
| /documentation/services/llm-context | research/rag |
| /documentation/resources/goggles | search/ranking |
| /documentation/resources/search-operators | search/filter |
| /documentation/quickstart | other/onboarding |
| /documentation/guides/authentication | other/auth |
| /documentation/guides/rate-limiting | other/infra |
| /documentation/guides/versioning | other/infra |
| /documentation | other/overview |
| /documentation/pricing | other/billing |
| /documentation/resources/skills | other/extensions |
| /documentation/resources/security | other/security |
| /documentation/guides/versioning | other/infra |
| /documentation/resources/help-feedback | other/support |
| /documentation/resources/privacy-notice | other/legal |
| /documentation/resources/status-updates | monitor |
| /documentation/resources/terms-of-service | other/legal |

---

## Feature Catalog

---

### 1. Web Search

**Category**: search  
**Endpoint**: `GET https://api.search.brave.com/res/v1/web/search`  
**Purpose**: Full-text search across Brave's independent web index (billions of pages). Human-consumption format with rich result types. The baseline API for all webular search workflows.

**Key Parameters**:
- `q` — query string (supports search operators inline)
- `count` — results per page (max 20, default 20)
- `offset` — page offset (0-based, max 9)
- `country` — 2-char ISO 3166-1 country code
- `search_lang` — ISO 639-1 content language
- `ui_lang` — UI language for response metadata
- `freshness` — `pd` (24h) | `pw` (7d) | `pm` (31d) | `py` (1yr) | `YYYY-MM-DDtoYYYY-MM-DD`
- `safesearch` — `off` | `moderate` (default) | `strict`
- `extra_snippets` — bool; up to 5 additional excerpts per result
- `goggles` — URL or inline DSL for custom re-ranking (max 3 per request)
- `summary` — `1` to trigger summarizer key generation (two-step flow)
- `enable_rich_callback` — `1` to enable rich result callback key
- `spellcheck` — bool (auto-corrects query before searching)

**Response Highlights**:
- `web.results[]` — array of `{title, url, description, age, extra_snippets[]}`
- `locations.results[]` — local POI results (when query has local intent)
- `summarizer.key` — opaque key to pass to summarizer endpoint
- `rich.hint.callback_key` — key for fetching real-time rich data
- `query.more_results_available` — bool to gate pagination

**FOSS Alternatives** (no paid API):
- `duckduckgo-search` (npm: `duck-duck-scrape`, pypi: `duckduckgo-search`) — DDG HTML scraping, free, no key
- `searxng` — self-hosted meta-search engine (Docker), aggregates 70+ engines
- `brave-search-npm` — unofficial npm wrapper; still requires API key but free tier exists
- `google-it` / `googlesearch-python` — scrape Google SERP (fragile, ToS risk)
- `SerpApi` open-source alternatives: `serpapi/google-search-results-nodejs` (paid); FOSS: SearXNG
- For offline/local index: `meilisearch`, `typesense`, `tantivy` (Rust), `lunr.js`

---

### 2. News Search

**Category**: search  
**Endpoint**: `GET https://api.search.brave.com/res/v1/news/search`  
**Purpose**: Dedicated news-article index from trusted outlets worldwide. Supports freshness filtering, Goggles, and extra snippets. Useful for media monitoring and real-time research.

**Key Parameters**:
- `q`, `country`, `search_lang`, `ui_lang` — same as Web Search
- `freshness` — same date-window options as Web Search
- `count` — max 50 (higher than web search), default 20
- `offset` — 0-based page (max 9)
- `safesearch` — `off` | `moderate` | `strict` (default)
- `extra_snippets` — bool (AI/Data plans)
- `goggles` — custom re-ranking (same as Web Search)

**FOSS Alternatives**:
- `newsapi-python` / `newsapi` npm — NewsAPI.org has a free tier (limited)
- `gnews` npm / pypi — scrapes Google News RSS, no key needed
- `feedparser` (pypi) — parse any RSS/Atom feed; pair with GDELT or MediaStack free tier
- `pygooglenews` — wraps Google News RSS programmatically
- `newsdataapi` — has free tier (200 req/day)
- SearXNG with news category enabled (`engines: [google news, bing news]`)

---

### 3. Image Search

**Category**: search / media  
**Endpoint**: `GET https://api.search.brave.com/res/v1/images/search`  
**Purpose**: Search billions of indexed images. Returns proxied thumbnails (500px wide) + original URLs. Higher result volume than other endpoints (up to 200 per request).

**Key Parameters**:
- `q`, `country`, `search_lang` — standard
- `count` — default 50, max 200
- `safesearch` — `strict` (default) | `off`
- `spellcheck` — bool (default true)

**Response Highlights**:
- Each result: `{title, url, thumbnail_url, properties.url (original), properties.placeholder, width?, height?, publisher}`
- Thumbnails proxied through Brave's CDN for privacy

**FOSS Alternatives**:
- `icrawler` (pypi) — multi-engine image crawler (Google/Bing/Baidu scrapers)
- `bing-image-creator` / `google-images-download` — SERP scraping (fragile)
- `unsplash-js` / `pexels-api` — stock photo APIs (free tier, require attribution)
- `DuckDuckGo Image Search` via `duckduckgo-search` Python library (`ddg_images()`)
- `playwright` + DOM parsing — headless scrape of any image SERP

---

### 4. Video Search

**Category**: search / media  
**Endpoint**: `GET https://api.search.brave.com/res/v1/videos/search`  
**Purpose**: Search video content across platforms (YouTube, Vimeo, etc.). Supports freshness, language, pagination, and spellcheck.

**Key Parameters**:
- `q`, `country`, `search_lang`, `ui_lang` — standard
- `freshness` — same date-window options
- `count` — max 50, default 20
- `offset` — 0-based (max 9)
- `safesearch` — `off` | `moderate` (default) | `strict`
- `spellcheck` — bool

**FOSS Alternatives**:
- `yt-dlp` — extract video metadata from YouTube, Vimeo, 1000+ sites (no API key for public content)
- `youtube-search-python` (pypi) — scrapes YouTube search results without API key
- `pytube` (pypi) — YouTube search + download
- `youtube_transcript_api` (pypi) — fetch captions/transcripts
- `tubeup` (archival), `you-get` — multi-site video metadata
- YouTube Data API v3 has generous free quota (10,000 units/day)

---

### 5. Autosuggest (Query Suggestions)

**Category**: search / query-aid  
**Endpoint**: `GET https://api.search.brave.com/res/v1/suggest/search`  
**Purpose**: Real-time query autocomplete as user types. Returns up to N query suggestions, optionally with entity metadata (title, description, thumbnail).

**Key Parameters**:
- `q` — partial query string
- `country` — 2-char country code
- `count` — number of suggestions (default 5)
- `rich` — bool; adds `is_entity`, `title`, `description`, `img` to entity suggestions (requires Autosuggest plan)

**Response**: `{type:"suggest", query:{original}, results:[{query, is_entity?, title?, description?, img?}]}`

**FOSS Alternatives**:
- `node-suggest` / `suggestions` npm — wraps Google/Wikipedia suggest endpoints
- Wikipedia Opensearch API (`https://en.wikipedia.org/w/api.php?action=opensearch`) — free, no key
- `completion-js` — client-side prefix-tree autocomplete (local, no API)
- DuckDuckGo autocomplete: `https://duckduckgo.com/ac/?q=<term>` — undocumented but public
- Google autocomplete (undocumented): `https://suggestqueries.google.com/complete/search?client=firefox&q=<term>`

---

### 6. Spellcheck

**Category**: search / query-aid  
**Endpoint**: `GET https://api.search.brave.com/res/v1/spellcheck/search`  
**Purpose**: Standalone spell-correction for search queries. Returns corrected query string(s). Also auto-applied in Web/Image/Video Search unless `spellcheck=false`.

**Key Parameters**:
- `q` — query string to check
- `country` — 2-char country code (affects correction corpus)

**Response**: `{type:"spellcheck", query:{original}, results:[{query:"corrected form"}]}`

**FOSS Alternatives**:
- `nspell` (npm) — Hunspell-based spell checking, 100+ language dictionaries
- `typo.js` (npm) — browser/Node Hunspell integration
- `pyspellchecker` (pypi) — pure Python, multiple languages
- `spacy` (pypi) — linguistic pipeline includes spellcheck-adjacent token correction
- `textblob` (pypi) — `TextBlob("helo").correct()` uses Peter Norvig's algorithm
- `symspellpy` (pypi) — very fast symmetric delete spelling correction
- `hunspell` (system package) — C library with bindings for Node (`hunspell-spellchecker`) and Python (`pyhunspell`)
- `languagetool` — self-hosted grammar+spell server (REST API)

---

### 7. Summarizer Search (DEPRECATED → use Answers)

**Category**: answer-summarize  
**Endpoints**:
- `GET /res/v1/web/search?summary=1` — step 1: get summarizer key
- `GET /res/v1/summarizer/search?key=<KEY>` — step 2: fetch summary
- `GET /res/v1/summarizer/summary` — just the summary text
- `GET /res/v1/summarizer/summary_streaming` — streaming summary
- `GET /res/v1/summarizer/title` — just the title
- `GET /res/v1/summarizer/enrichments` — related images, Q&A pairs, sources
- `GET /res/v1/summarizer/followups` — suggested follow-up queries
- `GET /res/v1/summarizer/entity_info` — detailed entity metadata

**Purpose**: Two-step AI summarization of web search results. Returns citations, entity information, and follow-up suggestions. Now superseded by the Answers API but still operational for Pro AI subscribers.

**Key Parameters** (summarizer/search):
- `key` — opaque key from web search response (required)
- `entity_info` — `1` to include entity descriptions/images
- `inline_references` — bool; adds citation markers to summary text

**Response**: `{status, title, summary, enrichments{raw, images, qa_pairs}, followups[], entities_info}`

**FOSS Alternatives**:
- Two-step approach: `duckduckgo-search` → `@mozilla/readability` + `openai` (or any LLM) for summarization
- `sumy` (pypi) — extractive summarization (LSA, LexRank, etc.), no LLM
- `bert-extractive-summarizer` (pypi) — BERT-based extractive summarizer
- `langchain` + local `ollama` — full RAG pipeline with summarization
- `llm` CLI (Simon Willison) — summarize via any model locally

---

### 8. Answers (AI-Grounded Q&A)

**Category**: answer-summarize  
**Endpoint**: `POST https://api.search.brave.com/res/v1/chat/completions` (OpenAI-compatible)  
**Purpose**: End-to-end AI answers with real-time web grounding. Same technology as Brave's "Ask Brave" product. OpenAI SDK compatible (`model: "brave"`). Supports streaming, citations, entity enrichment, and multi-search research mode. SOTA on SimpleQA benchmark.

**Key Parameters** (via `extra_body` when using OpenAI SDK):
- `model` — always `"brave"`
- `stream` — bool (required for citations/entities/research mode)
- `country` — target country for search results
- `language` — response language
- `enable_entities` — bool; include entity items in stream
- `enable_citations` — bool; inline citation tags in stream
- `enable_research` — bool; iterative multi-search mode (slower, more thorough)

**Response Stream Tags**:
- `<citation>{start_index, end_index, number, url, favicon, snippet}</citation>`
- `<enum_item>{uuid, name, href, original_tokens, citations[]}</enum_item>`
- `<usage>{X-Request-Requests, X-Request-Queries, X-Request-Tokens-In, X-Request-Tokens-Out, costs}</usage>`

**Pricing**: `(searches × $4/1000) + (input_tokens × $5/1M) + (output_tokens × $5/1M)`  
**Rate limit**: 2 req/sec default

**FOSS Alternatives**:
- `perplexica` — self-hosted Perplexity clone (Next.js + SearXNG + any LLM)
- `open-webui` + `searxng` + `ollama` — local RAG with web search
- `privateGPT` — local Q&A with document/web grounding
- `langchain` (`WebResearchRetriever`) + `ollama` — programmatic grounded Q&A
- `dspy` + SearXNG + local model — structured grounded reasoning
- Brave free tier (2000 req/month) for the search layer + local LLM for generation

---

### 9. LLM Context (RAG-Optimized Search)

**Category**: research / rag  
**Endpoints**: `GET /res/v1/llm/context` and `POST /res/v1/llm/context`  
**Purpose**: Machine-first search that returns pre-extracted, chunked, relevance-ranked page content (not raw HTML). Single API call returns LLM-ready grounding context with token budget controls. Optimized for AI agents and RAG pipelines.

**Key Parameters**:
- `q` — query (1-400 chars, max 50 words; required)
- `country`, `search_lang` — locale (same as Web Search)
- `count` — max search results to consider (1-50, default 20)
- `freshness` — same date-window options as Web Search
- `maximum_number_of_urls` — max URLs in response (1-50, default 20)
- `maximum_number_of_tokens` — approx token cap (1024-32768, default 8192)
- `maximum_number_of_snippets` — total snippets (1-100, default 50)
- `maximum_number_of_tokens_per_url` — per-URL token cap (512-8192, default 4096)
- `maximum_number_of_snippets_per_url` — per-URL snippet cap (1-100, default 50)
- `context_threshold_mode` — `strict` | `balanced` (default) | `lenient` | `disabled`
- `enable_local` — `true` | `false` | `null` (auto-detect from location headers)
- `goggles` — custom source re-ranking

**Location Headers** (for local queries):
- `X-Loc-Lat`, `X-Loc-Long`, `X-Loc-City`, `X-Loc-State`, `X-Loc-Country`, `X-Loc-Postal-Code`

**Response**:
```json
{
  "grounding": {
    "generic": [{"url", "title", "snippets": ["text or JSON-serialized tables/code"]}],
    "poi": {...},  // when enable_local
    "map": [...]   // when enable_local
  },
  "sources": {"<url>": {"title", "hostname", "age": [human, iso, relative]}}
}
```

**Context Size Guidelines**:
- Simple factual: count=5, max_tokens=2048
- Standard: count=20, max_tokens=8192 (defaults)
- Complex research: count=50, max_tokens=16384

**FOSS Alternatives**:
- `crawlee` (npm) — production-grade web crawler + content extractor for building your own RAG pipeline
- `playwright` + `@mozilla/readability` + `turndown` — fetch → extract readable → convert to Markdown
- `newspaper3k` / `newspaper4k` (pypi) — article extraction + NLP from any URL
- `trafilatura` (pypi) — high-quality text extraction from web pages, very fast
- `scraper-api` (free tier) + `cheerio` (npm) — structured HTML parsing
- `jina-reader` (free public endpoint `r.jina.ai/<url>`) — returns Markdown from any URL
- `firecrawl` (self-hosted) — full-featured scrape/crawl/extract pipeline
- `docling` (pypi, IBM) — converts HTML/PDF/DOCX to structured Markdown

---

### 10. Place Search / Local POI Discovery

**Category**: search / geo  
**Endpoints**:
- `GET /res/v1/local/place_search` — search 200M+ global places by query + coordinates/name
- `GET /res/v1/local/pois?ids=...` — fetch rich POI detail (photos, profiles, web mentions) for up to 20 IDs
- `GET /res/v1/local/descriptions?ids=...` — AI-generated descriptions for up to 20 POIs

**Purpose**: Geographic place discovery — businesses, landmarks, restaurants, hotels, parks. Returns structured POI data with ratings, hours, contact info, distance. IDs are ephemeral (~8 hours).

**Key Parameters** (place_search):
- `q` — what to search for (optional; omit for explore mode)
- `latitude` + `longitude` — search center (float pair)
- `location` — text alternative: `"city state country"` (US) or `"city country"` (international)
- `radius` — search bias radius in meters (no hard cutoff; optional)
- `count` — results per request (1-100, default 20)
- `country`, `search_lang`, `ui_lang` — locale
- `units` — `metric` | `imperial`
- `safesearch` — `off` | `moderate` | `strict` (default)
- `spellcheck` — bool

**Response Top-Level**:
- `results[]` — `LocationResult` (individual POIs)
- `cities[]` — `EnhancedPlaceResult` (city/region with nested POIs + AI description)
- `addresses[]` — specific addresses with nearby POIs
- `streets[]` — street-level results
- `mixed[]` — interleaving order hints for SERP display
- `location` — resolved search center

**LocationResult Fields**: id, title, url, provider_url, coordinates, postal_address, opening_hours, contact, rating, price_range, distance, categories, serves_cuisine, thumbnail, pictures, profiles, timezone

**FOSS Alternatives**:
- Overpass API (OpenStreetMap) — free, unlimited POI queries by category + bounding box; `overpy` (pypi), `osmtogeojson` (npm)
- `nominatim` — OpenStreetMap geocoding + reverse geocoding (free, self-hostable)
- Foursquare Places API — free tier (1000 req/day) for POI data
- Google Places API — free tier ($200/month credit)
- `places.js` / `leaflet-geosearch` — open geocoding + place search for browser apps
- `geopy` (pypi) — multiple geocoding backends (Nominatim, ArcGIS, etc.)

---

### 11. Rich Search (Real-Time Data Verticals)

**Category**: search / structured-data  
**Endpoints**:
- `GET /res/v1/web/search?enable_rich_callback=1` — get callback_key
- `GET /res/v1/web/rich?callback_key=<KEY>` — fetch rich result

**Purpose**: Real-time structured data from 3rd-party data providers attached to web search results. Covers multiple verticals where intent is detected.

**Supported Verticals**:
- **Calculator** — arithmetic/math expressions
- **Definitions** — word meanings (via Wordnik)
- **Unit Conversion** — length, weight, volume, temperature
- **Unix Timestamp** — timestamp ↔ human-readable datetime
- **Package Tracker** — shipment tracking across carriers
- **Stock** — real-time quotes, intraday changes (via FMP)
- **Currency** — exchange rates (via Fixer)
- **Cryptocurrency** — prices, market data (via CoinGecko)
- **Weather** — forecasts + conditions (via OpenWeatherMap)
- **Sports**: American Football (NFL/CFB), Baseball (MLB), Basketball (NBA + 18 leagues), Cricket (IPL/PSL), Football/Soccer (35+ leagues), Ice Hockey (NHL/Liiga), Formula 1

**FOSS Alternatives**:
- Weather: `open-meteo` (npm/pypi) — free, no key, global weather API
- Stocks: `yfinance` (pypi), `financedatapy` — Yahoo Finance unofficial API
- Crypto: `pycoingecko` (pypi) — CoinGecko API (free tier)
- Currency: `fixer-io` free tier; `exchangerate-api.com` (free 1500 req/month)
- Sports: `sportsdb-api` (npm/pypi) — TheSportsDB free tier
- Math: `mathjs` (npm), `sympy` (pypi) — local evaluation
- Geocoding/time: `luxon` / `dayjs` (npm), `pytz` (pypi)

---

### 12. Goggles (Custom Search Re-ranking)

**Category**: search / ranking  
**Integration**: `goggles` query parameter on Web Search, News Search, and LLM Context  
**Purpose**: Apply custom re-ranking rules on top of Brave's index using a simple DSL. Rules are hosted as `.goggle` files on GitHub/GitLab/Gist and must be registered at `search.brave.com/goggles/create`. Can be inline for simple cases.

**DSL Actions**:
- `$boost` / `$boost=N` — increase ranking (strength 1-10)
- `$downrank` / `$downrank=N` — decrease ranking (strength 1-10)
- `$discard` — remove matching results entirely

**DSL Targeting**:
- `site=domain.com` — exact domain match
- `site=sub.domain.com` — subdomain
- Path patterns: `/blog/$boost`
- Wildcards: `*/api/*$boost` (max 2 `*` per rule)
- Carets: max 2 `^` per rule

**Metadata Header** (required in `.goggle` files):
```
! name: My Goggles
! description: What it does
! public: true|false
! author: Name
```

**Limits**: max 3 goggles per request, max 2MB per file, max 100,000 rules, max 500 chars per rule

**FOSS Alternatives** (custom ranking without paid API):
- SearXNG engines priority configuration — reorder engine weights in `engines.yml`
- `elasticsearch` / `opensearch` — custom BM25 + boost queries on self-crawled index
- `meilisearch` — custom ranking rules (typoTolerance, custom attributes)
- `whoosh` (pypi) — pure-Python full-text search with custom scoring

---

### 13. Search Operators

**Category**: search / filter  
**Integration**: Embedded within the `q` parameter on Web, News, and Video Search  
**Purpose**: Query refinement DSL baked into the query string. Enables precise targeting by file type, domain, language, location, content placement, and logical combinations.

**Operator Reference**:
| Operator | Purpose | Example |
|----------|---------|---------|
| `ext:` | File extension | `manual ext:pdf` |
| `filetype:` | File type filter | `report filetype:pdf` |
| `intitle:` | Term in page title | `intitle:2024` |
| `inbody:` | Term in page body | `inbody:"founders edition"` |
| `inpage:` | Term in title or body | `inpage:keyword` |
| `lang:` / `language:` | ISO 639-1 language | `lang:es` |
| `loc:` / `location:` | ISO 3166-1 country | `loc:ca` |
| `site:` | Domain filter | `site:github.com` |
| `+` | Force include | `gpu +freesync` |
| `-` | Exclude term | `office -microsoft` |
| `""` | Exact phrase | `"order of the phoenix"` |
| `AND` | Logical AND | `loc:gb AND lang:en` |
| `OR` | Logical OR | `site:reuters.com OR site:bloomberg.com` |
| `NOT` | Logical NOT | `brave search NOT site:brave.com` |

**Note**: Logical operators must be UPPERCASE. Operators are experimental and behavior may vary.

**FOSS Alternatives**:
- SearXNG supports `site:`, `filetype:`, `intitle:`, `lang:` operators natively
- Elasticsearch query DSL — `must_not`, `filter`, `term` queries provide equivalent filtering on self-crawled content
- `whoosh` QueryParser — supports field-specific searches, phrase matching, boolean logic

---

### 14. Authentication

**Category**: other / auth  
**Method**: HTTP header `X-Subscription-Token: <YOUR_API_KEY>`  
**Notes**:
- Every endpoint requires this header
- API-Version header for version locking: `Api-Version: YYYY-MM-DD`
- Answers endpoint (OpenAI-compatible) passes the key as `api_key` in the OpenAI client constructor

---

### 15. Rate Limiting

**Category**: other / infra  
**Model**: 1-second sliding window + monthly quota  
**Response Headers**:
- `X-RateLimit-Limit` — e.g. `1, 15000` (per-second, per-month)
- `X-RateLimit-Policy` — e.g. `1;w=1, 15000;w=2592000`
- `X-RateLimit-Remaining` — remaining in each window
- `X-RateLimit-Reset` — seconds until each window resets
- **429** returned on exceed; only successful responses count against quota
- Answers API: 2 req/sec default

---

### 16. API Versioning

**Category**: other / infra  
**URL-level versioning**: `v1` in path (rare breaking redesigns only)  
**Header-level versioning**: `Api-Version: YYYY-MM-DD` header for backwards-incompatible changes  
**Default**: latest version if no `Api-Version` header provided  
**Backwards-compatible changes** (no action needed): new optional params, new response fields, new endpoints, property reordering, string format changes  
**Backwards-incompatible changes** (require opt-in via header): removing params, removing response properties, renaming properties, type changes

---

## Unique Capabilities Summary

1. **Independent search index** — not Google/Bing-backed; privacy-first; no user tracking
2. **LLM Context endpoint** — purpose-built single-call RAG context with token budget + threshold controls; returns pre-chunked snippets (text, JSON tables, code) ready for LLM injection
3. **Answers (OpenAI-compatible)** — `POST /chat/completions` with `model:"brave"` for drop-in grounded AI answers; streaming citations as structured JSON tags
4. **Research mode** — iterative multi-search with up to 53 queries / 1000 pages analyzed per question
5. **Goggles DSL** — publicly-hostable, shareable custom ranking rules applied server-side; 3 goggles per request, composable
6. **Rich Data Verticals** — structured real-time data (weather, stocks, sports, crypto, currency, calculators) triggered by intent detection via `enable_rich_callback`
7. **Local POI two-step flow** — ephemeral IDs from web search → detailed POI data with ratings, hours, photos, AI-generated descriptions (shared ID space between Web Search and Place Search)
8. **Place Search explore mode** — POI discovery without a query (just coordinates/radius) for map population
9. **Mixed result ordering** — `mixed[]` array on place results provides explicit interleaving hints for cities/addresses/streets/POIs on a SERP
10. **Summarizer specialized endpoints** — modular decomposition: title, enrichments, followups, entity_info as separate endpoints on same key
11. **Extra snippets** — up to 5 additional excerpts per web/news result for richer content preview without a full page fetch
12. **Image proxy/privacy** — all image thumbnails proxied through Brave CDN (500px), preventing source tracking
