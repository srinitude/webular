# Parallel Web Systems — Feature Catalog for webular

**Coverage**: 139 URLs inventoried, 32 pages deep-read (all pre-selected feature/API pages + API reference pages).
**Source**: https://docs.parallel.ai

---

## URL Inventory by Capability Bucket

| Bucket | Count | Key URLs |
|--------|-------|----------|
| **search** | 8 | /search/search-quickstart, /search/best-practices, /search/modes, /search/advanced-search-settings, /search/search-migration-guide, /api-reference/search/search, /integrations/mcp/search-mcp |
| **extract/scrape** | 5 | /extract/extract-quickstart, /extract/advanced-extract-settings, /extract/best-practices, /extract/extract-migration-guide, /api-reference/extract/extract |
| **research/answer-summarize** | 12 | /task-api/task-quickstart, /task-api/guides/*, /task-api/examples/task-deep-research, /task-api/examples/task-enrichment, /task-api/examples/interactive-research, /chat-api/chat-quickstart |
| **crawl/proxy** | 2 | /resources/crawler, /resources/source-policy |
| **monitor** | 9 | /monitor-api/monitor-quickstart, /monitor-api/monitor-events, /monitor-api/monitor-structured-outputs, /monitor-api/quickstart-snapshot, /monitor-api/monitor-webhooks, /monitor-api/monitor-slack, /monitor-api/monitor-task, /monitor-api/monitor-migrate, /api-reference/monitor/* |
| **entity-discovery (FindAll)** | 12 | /findall-api/findall-quickstart, /findall-api/core-concepts/*, /findall-api/features/*, /api-reference/findall/* |
| **batch/group** | 6 | /task-api/group-api, /api-reference/tasks/create-task-group, /api-reference/tasks/add-runs-to-task-group, /api-reference/tasks/fetch-task-group-runs, /api-reference/tasks/stream-task-group-events, /api-reference/tasks/retrieve-task-group |
| **streaming/SSE** | 5 | /task-api/task-sse, /findall-api/features/findall-sse, /api-reference/tasks/stream-task-run-events, /api-reference/tasks/stream-task-run-events-1 |
| **webhooks** | 4 | /task-api/webhooks, /monitor-api/monitor-webhooks, /findall-api/features/findall-webhook, /resources/webhook-setup |
| **ingest/schema-suggest** | 2 | /task-api/ingest-api, /api-reference/tasks-v1/create-task-run |
| **MCP/integrations** | 10 | /integrations/mcp/quickstart, /integrations/mcp/programmatic-use, /integrations/mcp/task-mcp, /integrations/mcp/search-mcp, /task-api/mcp-tool-call, /integrations/langchain, /integrations/anthropic-tool-calling, /integrations/openai-tool-calling, /integrations/n8n, /integrations/clawhub |
| **data-integrations** | 6 | /data-integrations/bigquery, /data-integrations/duckdb, /data-integrations/polars, /data-integrations/snowflake, /data-integrations/spark, /data-integrations/supabase |
| **service/account** | 8 | /service-api/apps/*, /service-api/balance/*, /service-api/keys/*, /integrations/account-api |
| **other** | 12 | /getting-started/overview, /getting-started/pricing, /getting-started/rate-limits, /getting-started/glossary, /resources/changelog, /resources/faqs, /resources/warnings-and-errors, /integrations/vercel, /integrations/zapier, /integrations/browseruse, etc. |

---

## Feature Catalog

---

### 1. Search API — Natural Language Web Search

**Category**: search
**Endpoint**: `POST /v1/search`
**SDK**: `client.search(objective, search_queries, ...)`

**Purpose**: Takes a natural-language research objective + 2–5 keyword queries and returns ranked, LLM-optimized excerpts from web sources in a single call. Replaces multiple keyword searches. Results are pre-compressed for token efficiency, with citation-aware ranking.

**Key Parameters**:
- `search_queries` (string[], required): 2–3 concise 3–6-word keyword queries
- `objective` (string, optional but strongly recommended): Full-sentence research goal, up to 5,000 chars
- `mode` (enum): `"basic"` (low latency, foreground) | `"advanced"` (default, higher quality, background)
- `max_chars_total` (int): Upper bound on total excerpt characters (default: dynamic)
- `client_model` (string): Model name consuming results (enables per-model optimizations)
- `session_id` (string): Group related search+extract calls into one logical task; reuse across calls
- `advanced_settings.source_policy`: Domain allow/deny list + `after_date` freshness filter
- `advanced_settings.fetch_policy`: Cached index vs. live fetch (`max_age_seconds`, `timeout_seconds`, `disable_cache_fallback`)
- `advanced_settings.excerpt_settings.max_chars_per_result` (int)
- `advanced_settings.location` (ISO 3166-1 alpha-2): Geo-targeted results
- `advanced_settings.max_results` (int, default 10)

**Response Fields**: `search_id`, `results[].url`, `results[].title`, `results[].publish_date`, `results[].excerpts[]`, `session_id`, `warnings`, `usage`

**FOSS Alternatives (no paid API)**:
- `duckduckgo-search` (pypi: `duckduckgo_search`) — SERP scraping, free, no key
- SearXNG (self-hosted meta-search engine, Docker-deployable)
- Brave Search free tier (API, 2000 req/month free)
- `googlesearch-python` (pypi) — scrapes google.com results
- Bing Web Search free tier via Azure (1000 req/month)
- `serper.dev` free tier (2500 req lifetime)
- For excerpt extraction after search: `newspaper3k`, `trafilatura`, `readability-lxml` (pypi)

---

### 2. Extract API — URL to Clean Markdown

**Category**: extract/scrape
**Endpoint**: `POST /v1/extract`
**SDK**: `client.extract(urls, objective, ...)`

**Purpose**: Converts any public URL (including JS-heavy SPAs and PDFs) into clean, LLM-optimized markdown. Supports up to 20 URLs per call. Returns focused excerpts aligned to an objective, or full page markdown. Handles JS rendering server-side.

**Key Parameters**:
- `urls` (string[], required): Up to 20 URLs
- `objective` (string, optional): Research goal for excerpt focusing; omit for full-page dump
- `search_queries` (string[]): Keywords for better excerpt relevance
- `session_id` (string): Link to related search calls
- `max_chars_total` (int): Total excerpt characters cap
- `advanced_settings.fetch_policy`: `max_age_seconds` (min 600), `timeout_seconds`, `disable_cache_fallback`
- `advanced_settings.excerpt_settings.max_chars_per_result`
- `advanced_settings.full_content` (bool | object): Return full page content in addition to excerpts; `max_chars_per_result` cap applies

**Response Fields**: `extract_id`, `results[].url`, `results[].title`, `results[].publish_date`, `results[].excerpts[]`, `results[].full_content` (if enabled), `errors[].url`, `errors[].error_type`, `errors[].http_status_code`, `session_id`, `warnings`, `usage`

**FOSS Alternatives (no paid API)**:
- `playwright` (npm/pypi) — headless Chromium for JS rendering
- `puppeteer` (npm) — headless Chrome
- `crawlee` (npm) — Playwright/Puppeteer crawler with antibot handling
- `@mozilla/readability` (npm) — article extraction from HTML
- `turndown` (npm) — HTML to Markdown conversion
- `cheerio` (npm) — jQuery-style HTML parsing
- `trafilatura` (pypi) — article/content extraction from HTML
- `readability-lxml` (pypi) — Python port of Mozilla Readability
- `html2text` (pypi) — HTML to Markdown
- `pdf-parse` (npm) — PDF text extraction
- `pdfplumber` / `PyMuPDF` (pypi) — PDF extraction Python
- `unstructured` (pypi) — multi-format document parsing (PDF, HTML, DOCX)
- Bun's built-in `HTMLRewriter` — streaming HTML transformation/extraction

---

### 3. Task API — Multi-Step Web Research Agent

**Category**: research/answer-summarize
**Endpoint**: `POST /v1/tasks/runs`
**SDK**: `client.task_run.create(input, processor, task_spec, ...)`

**Purpose**: Asynchronous AI agent that combines web search + live crawling to execute multi-step research tasks. Takes plain-language or JSON input, runs seconds to 2 hours depending on processor tier, returns structured cited output. Core workflow: create run → poll/stream/webhook for completion → retrieve result.

**Key Parameters (create)**:
- `processor` (string, required): `lite | base | core | core2x | pro | ultra | ultra2x | ultra4x | ultra8x` (append `-fast` for 2–5x faster variants)
- `input` (string | object, required): Research question or JSON entity data
- `task_spec.output_schema`: One of:
  - Plain string (shorthand text schema)
  - `{"type": "json", "json_schema": {...}}` — structured enrichment
  - `{"type": "text", "description": "..."}` — markdown report with inline citations
  - `{"type": "auto"}` — auto-structured (deep research mode, `pro`+ only)
- `task_spec.input_schema`: Optional JSON schema for input validation
- `metadata` (object): User tags (key/value strings, max 16/512 chars)
- `source_policy.include_domains` / `exclude_domains`: Domain allow/deny list (max 200 total)
- `previous_interaction_id` (string): Chain context from prior task/chat call
- `mcp_servers[]` (beta `parallel-beta: mcp-server-2025-07-17`): Remote MCP servers for tool calling during task execution
- `enable_events` (bool): Enable SSE progress events (default true for `pro`+)
- `webhook` (object): HTTP callback on completion (beta `parallel-beta: webhook-2025-08-12`)

**Processor Tiers**:
| Tier | Latency (standard) | Fields | Use |
|------|-------------------|--------|-----|
| `lite[-fast]` | 10–60s / 10–20s | ~2 | Basic metadata |
| `base[-fast]` | 15–100s / 15–50s | ~5 | Standard enrichments |
| `core[-fast]` | 60s–5min / 15–100s | ~10 | Cross-referenced outputs |
| `core2x[-fast]` | 60s–10min / 15–3min | ~10 | Complex multi-source |
| `pro[-fast]` | 2–10min / 30s–5min | ~20 | Exploratory research |
| `ultra[-fast]` | 5–25min / 1–10min | ~20 | Deep multi-source |
| `ultra2x/4x/8x[-fast]` | up to 2hr | ~25 | Hardest research |

**Response Fields**: `run_id`, `interaction_id`, `status` (queued/running/completed/failed), `is_active`, `output.content`, `output.basis[].field`, `output.basis[].citations[].url`, `output.basis[].citations[].excerpts`, `output.basis[].reasoning`, `output.basis[].confidence` (high/medium/low), `output.type` (json|text)

**FOSS Alternatives (no paid API)**:
- Build with: `playwright`/`puppeteer` (crawling) + `duckduckgo-search`/SearXNG (search) + `trafilatura`/`readability` (extraction) + local LLM via `ollama` + `langchain`/`llamaindex` (orchestration)
- `open-deep-research` (GitHub: dzhng/deep-research) — open-source deep research agent
- `gpt-researcher` (pypi: gpt-researcher) — open-source research agent
- `storm` (SALT-NLP/storm, GitHub) — multi-agent wiki research

---

### 4. Research Basis — Per-Field Citations and Confidence

**Category**: research/answer-summarize
**SDK**: Available on all Task API results

**Purpose**: Every Task Run result includes a `basis` array providing structured transparency: for each output field, citations (URLs + excerpts), reasoning text, and confidence level (high/medium/low). Opt-in per-element basis for array fields via `parallel-beta: field-basis-2025-11-25` header.

**Key Fields**:
- `output.basis[].field` (string): Output field name (dot-notation for nested, e.g. `key_executives.0`)
- `output.basis[].citations[].url`
- `output.basis[].citations[].excerpts[]`
- `output.basis[].reasoning` (string): How sources were reconciled
- `output.basis[].confidence` (string): `"high" | "medium" | "low"`

**FOSS Alternatives**:
- Build citation tracking manually: store source URLs during scraping; use LLM prompting to attribute claims to sources
- `langchain` citation chains with source documents
- `ragas` (pypi) — RAG evaluation including faithfulness/citation scoring

---

### 5. Task Groups — Batch Processing at Scale

**Category**: batch
**Endpoints**:
- `POST /v1/tasks/groups` — create group
- `POST /v1/tasks/groups/{taskgroup_id}/runs` — add runs (up to 1,000 per POST)
- `GET /v1/tasks/groups/{taskgroup_id}` — status snapshot
- `GET /v1/tasks/groups/{taskgroup_id}/runs` — SSE stream of run snapshots
- `GET /v1/tasks/groups/{taskgroup_id}/events` — live SSE stream of completions
- `GET /v1/tasks/runs/{run_id}/result` — individual result

**Purpose**: Batch process hundreds/thousands of Task Runs concurrently. Organizes runs into a group with aggregate status tracking (`is_active`, `task_run_status_counts`). Groups can receive new runs at any time.

**Key Parameters**:
- `default_task_spec` (object): Applied to all runs unless overridden per-run
- `inputs[]`: Array of `{input, processor, task_spec?, metadata?}` per run
- `refresh_status` (bool, default true): Skip status refresh on bulk add for speed
- `include_input` / `include_output` (bool): Include in SSE stream events
- `last_event_id` (string): Resume SSE stream from cursor

**SSE Event Types**:
- `task_run.state` — run status change
- `error` — error event

**FOSS Alternatives**:
- `asyncio.gather` / `concurrent.futures.ThreadPoolExecutor` (Python) for parallel execution
- `p-limit` / `p-queue` (npm) for concurrency-limited parallel fetching
- `BullMQ` (npm) / `rq` (pypi) — job queue with batch processing
- `crawlee` (npm) — built-in batch/queue crawler

---

### 6. Task Streaming Events (SSE) — Real-Time Progress

**Category**: streaming
**Endpoint**: `GET /v1beta/tasks/runs/{run_id}/events`
**Beta header**: `parallel-beta: events-sse-2025-07-24`

**Purpose**: Stream real-time Server-Sent Events for individual task run progress. Useful for interactive UIs showing research progress. Streams complete reasoning trace from run start (stateless reconnection — full trace re-sent on reconnect). Events remain available 570s after run completes.

**Enable**: Set `enable_events: true` on task create (default true for `pro`+).

**Event Types**:
- `task_run.state`: Run status; includes full `output` on final event for completed tasks
- `task_run.progress_msg.exec_status`: Status message ("Starting research")
- `task_run.progress_msg.plan`: Research plan text
- `task_run.progress_msg.tool`: Tool call summary
- `task_run.progress_stats`: `{num_sources_considered, num_sources_read, sources_read_sample[]}`
- `error`: Execution error

**FOSS Alternatives**:
- SSE is a native browser/HTTP mechanism; implement server-side SSE with `eventsource` (npm), `httpx` (pypi async streaming), or Bun's native `Response` streaming
- `EventSource` (browser native) / `eventsource` (npm) for client consumption

---

### 7. Task Webhooks — Async Completion Callbacks

**Category**: webhooks
**Beta header**: `parallel-beta: webhook-2025-08-12`

**Purpose**: Register a webhook URL at task creation time; Parallel POSTs when run completes. Webhook is a notification (not data delivery) — you still call `/result` to get output. HMAC-SHA256 signature verification via `webhook-signature` header.

**Key Parameters**:
- `webhook.url` (string): HTTPS endpoint
- `webhook.event_types[]`: `["task_run.status"]`

**Signature Verification**: `HMAC-SHA256(${webhook_id}.${webhook_timestamp}.${raw_body})` using account webhook secret from platform settings.

**FOSS Alternatives**:
- `svix` (self-hosted webhook service)
- Implement HMAC verification: `crypto.createHmac('sha256', secret).update(body).digest('hex')` (Node.js) / `hmac.new(secret, body, sha256)` (Python)
- For local development: `ngrok`, `localtunnel`, Cloudflare Tunnel

---

### 8. Ingest API — Task Schema Generation from Natural Language

**Category**: ingest/schema-suggest
**Endpoints**:
- `POST /v1beta/tasks/suggest` — generate task spec from natural language intent
- `POST /v1beta/tasks/suggest-processor` — recommend best processor for a task spec

**Purpose**: Converts user intent ("Find the CEOs of tech companies") into structured `input_schema` + `output_schema` for the Task API. Can iterate on prior schemas (`previous_task`). `suggest-processor` analyzes task complexity and recommends the lowest-cost processor that can reliably complete it.

**Key Parameters (suggest)**:
- `user_intent` (string, required): Plain language description
- `previous_task` (SuggestedTaskSpec, optional): Iterate/refine existing spec; constrains input columns

**Key Parameters (suggest-processor)**:
- `task_spec` (object, required): Schema to analyze
- `choose_processors_from` (string[]): Limit recommendation pool

**FOSS Alternatives**:
- Use an LLM (GPT-4, Claude, local Llama) with a prompt to generate JSON Schema from natural language
- `jsonschema` (pypi) / `zod` (npm) for schema validation

---

### 9. Multi-Turn Interactions (Conversation Chaining)

**Category**: research/answer-summarize
**Available on**: Task API and Chat API

**Purpose**: Chain context across multiple Task API or Chat API calls. Each response returns an `interaction_id`; pass it as `previous_interaction_id` on the next call to carry forward context. Enables follow-up questions, iterative refinement, and conversational research agents. Not available for Zero Data Retention customers.

**Key Fields**:
- `previous_interaction_id` (request): ID from prior call's response
- `interaction_id` (response): ID to pass to next call

**FOSS Alternatives**:
- Pass conversation history as context in each prompt (standard chat pattern)
- `langchain` `ConversationChain` / `ChatMessageHistory`
- Redis or in-memory store to persist conversation context between requests

---

### 10. MCP Tool Calling in Tasks

**Category**: research/answer-summarize
**Beta header**: `parallel-beta: mcp-server-2025-07-17`

**Purpose**: Specify remote MCP servers for Task API execution. The task processor can invoke tools hosted on external MCP servers during research. Up to 10 MCP servers per request; only Streamable HTTP transport supported. Response includes `output.mcp_tool_calls[]` with tool call log.

**Key Parameters**:
- `mcp_servers[].type` (string): Always `"url"`
- `mcp_servers[].url` (string): MCP server URL
- `mcp_servers[].name` (string): Server name
- `mcp_servers[].headers` (object): Auth headers (e.g., Bearer token)
- `mcp_servers[].allowed_tools` (string[] | null): Tool allowlist

**FOSS Alternatives**:
- Build MCP servers with `@modelcontextprotocol/sdk` (npm) or `mcp` (pypi)
- Run tools as local function calls in LangChain/LlamaIndex agents

---

### 11. Monitor API — Continuous Web Tracking

**Category**: monitor
**Endpoints**:
- `POST /v1alpha/monitors` (or `/v1/monitors` in v1) — create monitor
- `GET /v1/monitors` — list monitors
- `GET /v1/monitors/{monitor_id}` — retrieve
- `PATCH /v1/monitors/{monitor_id}` — update
- `DELETE /v1/monitors/{monitor_id}` — cancel
- `POST /v1/monitors/{monitor_id}/trigger` — manual run
- `GET /v1/monitors/{monitor_id}/events` — list events

**Purpose**: Scheduled natural-language web monitoring. Define a query and frequency; when material changes are detected, Parallel fires a webhook or events can be polled. Two types:
- `event_stream`: Track a search query for changes (news, regulatory, competitive)
- `snapshot`: Diff a Task Run output across executions (structured change tracking)

**Key Parameters**:
- `type` (string): `"event_stream"` | `"snapshot"`
- `frequency` (string): `"1h"`, `"6h"`, `"1d"`, `"1w"`, `"30d"`
- `processor` (string): `"lite"` (default) | `"base"` for harder queries
- `settings.query` (string): Natural language monitoring query
- `webhook.url` (string): HTTPS endpoint for notifications
- `webhook.event_types[]`: `["monitor.event.detected"]`
- `output_schema` (object): Optional JSON schema for structured event output (flat, 3–5 fields, string/enum types)
- `metadata` (object): User tags

**Event Fields**: `event_id`, `event_group_id`, `event_date`, `source_urls[]`, `output.content`, `output.type`

**FOSS Alternatives**:
- `changedetection.io` (self-hosted, Docker) — web change monitoring with notifications
- `distill.io` free tier — visual web change detection
- Cron + `playwright`/`puppeteer` + diff — custom change detection pipeline
- `trafilatura` for content extraction + SHA hash diffing
- `Huginn` (self-hosted) — web scraping + trigger agent

---

### 12. Monitor Structured Outputs

**Category**: monitor
**Available on**: Monitor API

**Purpose**: Define a JSON schema for monitor events so each detected change returns machine-readable structured data (e.g., `{company_name, sentiment, description}`). Use flat schemas with 3–5 primitive (`string`, `enum`) fields.

**FOSS Alternatives**:
- Pipe extracted content through a local LLM with structured output prompting (`instructor` pypi, `zod` with OpenAI function calling)
- `json-schema` validation on LLM output

---

### 13. FindAll API — Entity Discovery

**Category**: entity-discovery
**Beta header**: `parallel-beta: findall-2025-09-15`
**Endpoints**:
- `POST /v1beta/findall/ingest` — NL to schema
- `POST /v1beta/findall/runs` — create run
- `GET /v1beta/findall/runs/{findall_id}` — status
- `GET /v1beta/findall/runs/{findall_id}/result` — results
- `POST /v1beta/findall/runs/{findall_id}/enrich` — add enrichments
- `GET /v1beta/findall/runs/{findall_id}/schema` — inspect generated schema
- `POST /v1beta/findall/runs/{findall_id}/extend` — increase match limit
- `POST /v1beta/findall/runs/{findall_id}/cancel`
- `POST /v1beta/findall/runs/{findall_id}/refresh`
- `GET /v1beta/findall/runs/{findall_id}/events` — SSE stream

**Purpose**: Web-scale entity discovery from natural language queries. Generates candidates from web data, evaluates each against match conditions, returns verified matches with citations. Three-stage pipeline: Generate → Evaluate (match conditions) → Enrich (optional Task API enrichment on matched candidates only).

**Key Parameters (create)**:
- `objective` (string): Natural language description
- `entity_type` (string): `"companies"`, `"people"`, etc.
- `match_conditions[]`: Array of `{name, description}` — boolean/filterable predicates
- `generator` (string): `"preview"` (~10 candidates, test) | `"base"` | `"core"` | `"pro"`
- `match_limit` (int, 5–1000): Max matched candidates to return
- `exclude_list[]`: `{name, url}` entities to skip (deduplication intelligence included)

**Candidate Object**: `candidate_id`, `name`, `url`, `description`, `match_status` (generated|matched|unmatched), `output.{field_name}.{value, type, is_matched?}`, `basis[]` (same FieldBasis as Task API)

**FindAll Enrichments**: Added via `POST /enrich` with `processor` + `output_schema` (Task API format). Runs only on matched candidates; input_schema auto-set to `{name, url, description}`.

**FOSS Alternatives**:
- Build with: SearXNG/duckduckgo-search + `playwright`/`trafilatura` + local LLM for entity extraction + `langchain` agents for evaluation loops
- `company-research` patterns using LinkedIn scraping (niche)
- `crunchbase` scraping (ToS-restricted)
- `apollo.io` free tier for lead discovery

---

### 14. FindAll SSE + Webhooks — Real-Time Entity Events

**Category**: streaming / webhooks
**Endpoint**: `GET /v1beta/findall/runs/{findall_id}/events`

**Purpose**: Stream candidate events in real-time. Resumable via `event_id` cursor (unlike Task Run SSE). Events: `findall.candidate.matched`, `findall.candidate.enriched`, `findall.status`.

**Webhook Events**: `findall.candidate.matched`, `findall.candidate.enriched`

---

### 15. Chat API (OpenAI-Compatible)

**Category**: research/answer-summarize
**Endpoint**: `POST /chat/completions`
**Auth**: `Authorization: Bearer $PARALLEL_API_KEY`

**Purpose**: OpenAI ChatCompletions-compatible streaming chat endpoint with web research capabilities. Supports `speed` model (~3s p50 TTFT) for interactive use, plus research models (`lite`, `base`, `core`) that wrap Task API processors and return full `basis` field with citations, reasoning, and confidence.

**Models**:
- `speed`: Low latency, no basis, ~3s TTFT
- `lite` / `base` / `core`: Research-grade, includes `basis`, latency per Task API tier

**Supported Fields**: `model`, `messages[].role`, `messages[].content` (string only), `messages[].name`, `response_format` (full support including JSON schema), `stream`

**Unsupported/Ignored**: `max_tokens`, `temperature`, `top_p`, `tools`, `tool_calls`, multimodal content, prompt caching

**FOSS Alternatives**:
- `ollama` (local LLM serving with OpenAI-compatible API) + web search tool
- `lm-studio` (local OpenAI-compatible server)
- `open-webui` + `perplexica` (self-hosted web search chat)
- `litellm` (proxy for multiple LLM providers)

---

### 16. Source Policy — Domain Filtering

**Category**: search / research
**Available on**: Task API, Search API

**Purpose**: Control which domains processors can access. Hard allow/deny lists per request.

**Key Parameters**:
- `source_policy.include_domains` (string[]): Only these domains (apex, e.g. `"example.com"`, includes all subdomains). Max 200 combined.
- `source_policy.exclude_domains` (string[]): Block these domains
- `source_policy.after_date` (date string, Search API only): Freshness filter (YYYY-MM-DD format)

**FOSS Alternatives**:
- Filter URLs before/after fetching using allowlists in code
- `robots.txt` parsers for respecting site policies: `robotparser` (Python stdlib), `robots-txt-guard` (npm)

---

### 17. Task Spec — Structured Input/Output Schema Definition

**Category**: research/answer-summarize

**Purpose**: Declarative template defining Task API research structure. Input schema + output schema. Supports JSON Schema, plain text description, Pydantic (Python SDK), or `auto` mode. Field-level `description` is the primary quality control lever — acts as per-field prompt.

**Schema Validation Rules**:
- Root must be `{"type": "object"}` with `properties`
- All properties must be `required`; use `{"type": ["string","null"]}` for optional
- `additionalProperties: false` required
- Max nesting depth: 5; max properties: 100; max total chars: 25,000 (spec + input combined)
- Unsupported keywords: `minLength`, `maxLength`, `pattern`, `format`, `contains`, `minimum`, `maximum`, etc.

**FOSS Alternatives**:
- JSON Schema (jsonschema pypi, ajv npm) for validation
- `zod` (npm) for TypeScript schema definition
- `pydantic` (pypi) for Python model-based schemas

---

### 18. Deep Research Mode

**Category**: research/answer-summarize

**Purpose**: Multi-step web exploration for open-ended research questions without structured input. Uses `pro`/`ultra` processors with `auto` or `text` output schema. Automatically interprets research intent, conducts multi-source web exploration, synthesizes into structured JSON or markdown reports with inline citations. Input limit: 15,000 characters.

**Output Formats**:
- `auto`: Automatically structured JSON with nested FieldBasis (dot-notation indexing)
- `text`: Markdown report with inline citations and full citation list

**Async Patterns**:
- **Polling**: Repeatedly call `client.task_run.retrieve(run_id)` until `status == "completed"`, then call `result()`
- **Webhooks**: Register `webhook.url` at creation; POST to URL on completion; call `result()` to get data
- **SSE**: `enable_events: true` + stream from `/v1beta/tasks/runs/{run_id}/events`; final `task_run.state` event includes complete output

**FOSS Alternatives**:
- `gpt-researcher` (pypi, GitHub: assafelovic/gpt-researcher) — full open-source deep research agent
- `storm` (GitHub: stanford-oval/storm) — multi-agent research to structured reports
- `open-deep-research` (GitHub: dzhng/deep-research) — TypeScript deep research
- `perplexica` (self-hosted, GitHub: ItzCrazyKns/Perplexica) — open-source Perplexity clone

---

### 19. Data Enrichment via Task API

**Category**: research/answer-summarize

**Purpose**: Populate structured fields about entities (company, person, product) from live web data. Bring existing records (CRM, spreadsheet, database) and add new columns with researched, cited data. Patterns: single field, multi-field JSON schema, or batch via Task Groups.

**Common Use Cases**: Company founding date, employee count, funding sources, executive names, HQ address, annual revenue, product list, recent acquisitions

**FOSS Alternatives**:
- Build: entity name → search → extract → LLM for field extraction
- `clearbit` free tier (very limited)
- `pdl` (People Data Labs) free tier
- Manual: `playwright` scrape company website + LinkedIn + CrunchBase → `trafilatura` → local LLM extraction

---

### 20. MCP Integration — Parallel as MCP Server

**Category**: search / extract
**Transport**: Streamable HTTP
**URL**: `https://search.parallel.ai/mcp`
**Install**: `claude mcp add --transport http parallel-search https://search.parallel.ai/mcp`

**Purpose**: Exposes Parallel Search and Extract as MCP tools usable from any MCP-compatible agent (Claude Code, Cursor, VS Code Copilot, Codex, etc.). Free tier, no account required. Auto-provides tool definitions; no manual schema needed.

**FOSS Alternatives**:
- Self-host a SearXNG MCP server
- `mcp-server-brave-search` (npm, with free tier key)
- `mcp-server-fetch` (npm) — simple URL fetch as MCP tool

---

### 21. Task API v1 (Legacy)

**Category**: research/answer-summarize
**Endpoint**: `POST /v1beta/tasks/runs` (deprecated, use `/v1/tasks/runs`)

**Purpose**: Original task endpoint. Same functionality as v1 Task API but older request/response shape. Migration guide available.

---

## Summary Table

| Feature | Endpoint(s) | Key Params | FOSS Stack |
|---------|-------------|------------|------------|
| Natural language web search | `POST /v1/search` | `objective`, `search_queries`, `mode`, `source_policy` | duckduckgo-search, SearXNG |
| URL to markdown extraction | `POST /v1/extract` | `urls`, `objective`, `fetch_policy`, `full_content` | playwright + turndown + trafilatura |
| AI research agent (task) | `POST /v1/tasks/runs` | `processor`, `task_spec`, `source_policy`, `mcp_servers` | gpt-researcher, langchain + local LLM |
| Per-field citations & confidence | task result `output.basis[]` | `field`, `citations[]`, `reasoning`, `confidence` | manual source attribution |
| Batch task processing | `POST /v1/tasks/groups` + runs | `default_task_spec`, `inputs[]`, `refresh_status` | asyncio.gather, BullMQ, rq |
| SSE progress streaming | `GET /v1beta/tasks/runs/{id}/events` | `enable_events: true` | native SSE + EventSource |
| Completion webhooks | `webhook` on task create | `url`, `event_types`, HMAC verification | svix self-hosted |
| Schema-from-NL generation | `POST /v1beta/tasks/suggest` | `user_intent`, `previous_task` | LLM + JSON Schema |
| Multi-turn research chat | `previous_interaction_id` field | cross-processor context chaining | LangChain ConversationChain |
| Remote MCP tool calling | `mcp_servers[]` on task | `type`, `url`, `name`, `headers`, `allowed_tools` | local function tools |
| Scheduled web monitoring | `POST /v1/monitors` | `type`, `frequency`, `settings.query`, `webhook` | changedetection.io |
| Structured monitor events | `output_schema` on monitor | flat JSON schema, string/enum only | instructor + local LLM |
| Entity discovery (FindAll) | `POST /v1beta/findall/runs` | `objective`, `entity_type`, `match_conditions[]`, `generator` | SearXNG + playwright + LLM eval loop |
| FindAll enrichment | `POST /findall/{id}/enrich` | `processor`, `output_schema` (Task API format) | same as task enrichment |
| OpenAI-compat chat w/ web search | `POST /chat/completions` | `model` (speed/lite/base/core), `response_format`, `stream` | ollama + perplexica |
| Domain filtering (source policy) | `source_policy` on task/search | `include_domains[]`, `exclude_domains[]`, `after_date` | URL filtering in code |
| Fetch policy (freshness control) | `advanced_settings.fetch_policy` | `max_age_seconds`, `timeout_seconds`, `disable_cache_fallback` | playwright live fetch |
| Geo-targeted search | `advanced_settings.location` | ISO 3166-1 alpha-2 | SearXNG location param |

---

## Coverage Notes

- **totalUrls**: 139 (from parallel.urls.json)
- **deepReadCount**: 32 pages (all pre-selected pages + 3 API reference pages)
- Pages not scraped (skipped): API reference pages for individual CRUD endpoints (`retrieve-task-run`, `retrieve-task-run-result`, `tasks-v1/create-task-run`, monitor/findall CRUD endpoints) — these are thin reference pages whose parameters are fully captured from the guide pages above.
- Noted error pages: None — all 32 scrapes succeeded.
- Data integrations (BigQuery, DuckDB, Polars, Snowflake, Spark, Supabase) are output destinations for enrichment results, not web features; not catalogued as web capabilities.
- Service API (apps, balance, keys) is account management, not web research; not catalogued.
