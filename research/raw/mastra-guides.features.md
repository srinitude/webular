# Mastra Framework — Web-Relevant Features for Webular CLI

**Source:** https://mastra.ai/docs  
**Coverage:** 30 pages deep-read (all pre-selected); 1139 total URLs catalogued  
**Date:** 2026-06-02

---

## URL Inventory — Capability Buckets

Total URLs in inventory: **1139**

| Bucket | URL count (approx) | Example paths |
|--------|-------------------|---------------|
| **Framework primitives / docs** | ~180 | `/docs/workflows/*`, `/docs/agents/*`, `/reference/workflows/*`, `/reference/agents/*`, `/reference/tools/*` |
| **RAG / chunk / embed / vector** | ~30 | `/docs/rag/*`, `/reference/rag/*`, `/reference/vectors/*` |
| **Streaming** | ~15 | `/docs/streaming/*`, `/reference/streaming/*` |
| **MCP (tool protocol)** | ~12 | `/docs/mcp/*`, `/reference/tools/mcp-*` |
| **Storage / memory** | ~30 | `/docs/memory/*`, `/reference/storage/*`, `/reference/memory/*` |
| **Observability / tracing** | ~25 | `/docs/observability/*`, `/reference/observability/*` |
| **Server / deployment / auth** | ~40 | `/docs/server/*`, `/docs/deployment/*`, `/reference/server/*` |
| **Evals / scoring** | ~25 | `/docs/evals/*`, `/reference/evals/*` |
| **Voice** | ~15 | `/docs/voice/*`, `/reference/voice/*` |
| **Browser / workspace** | ~20 | `/docs/browser/*`, `/reference/browser/*`, `/reference/workspace/*` |
| **Model providers / gateways** | ~130 | `/models/providers/*`, `/models/gateways/*` |
| **Guides / tutorials** | ~50 | `/guides/guide/*`, `/guides/getting-started/*`, `/guides/deployment/*` |
| **Blog / changelogs** | ~120 | `/blog/*` |
| **Podcasts / workshops** | ~120 | `/podcasts/*`, `/workshops/*` |
| **Templates** | ~15 | `/templates/*` |
| **Learn / concepts** | ~20 | `/learn/*`, `/guides/concepts/*` |
| **Auth providers** | ~15 | `/docs/server/auth/*`, `/reference/auth/*` |
| **Processors (guardrails)** | ~20 | `/docs/agents/processors`, `/reference/processors/*` |
| **Misc (marketing, authors, etc.)** | ~120 | `/about`, `/careers`, `/pricing`, `/authors/*` |

---

## Mastra Primitives — What Webular BUILDS WITH

These are deterministic, non-LLM control-flow primitives that webular pipelines will use as orchestration infrastructure.

---

### 1. `createWorkflow` / `createStep`

**Package:** `@mastra/core/workflows`  
**Purpose:** Define typed, composable pipelines of steps with schema-validated inputs/outputs. The core orchestration unit webular uses to sequence scrape → parse → extract → summarize.

**Key params on `createWorkflow`:**
- `id: string` — unique workflow identifier
- `inputSchema: StandardJSONSchemaV1` — Zod/Valibot/ArkType schema
- `outputSchema: StandardJSONSchemaV1`
- `stateSchema?: StandardJSONSchemaV1` — shared mutable store across steps
- `requestContextSchema?: StandardJSONSchemaV1` — validated context injected per-request
- `schedule?: WorkflowScheduleConfig | WorkflowScheduleConfig[]` — built-in cron
- `retryConfig?: { attempts, delay }` — workflow-level retry
- `options.onFinish?: (result) => void` — completion lifecycle hook
- `options.onError?: (errorInfo) => void` — error lifecycle hook
- `options.validateInputs?: boolean` — validate and apply default values on start
- `options.shouldPersistSnapshot?: (params) => boolean`

**Key params on `createStep`:**
- `id: string`
- `description?: string`
- `inputSchema`, `outputSchema`, `stateSchema`, `resumeSchema`, `suspendSchema`, `requestContextSchema`
- `retries?: number` — step-level retry override
- `execute: async ({ inputData, resumeData, suspendData, mastra, getStepResult, getInitData, suspend, bail, state, setState, runId, requestContext, retryCount, metadata }) => Promise<any>`

**FOSS candidates (webular will BUILD these primitives, not replace them):**
- `zod` (npm) — schema validation for inputSchema/outputSchema
- `valibot` (npm) — alternative schema library
- `arktype` (npm) — alternative schema library

---

### 2. Workflow Control-Flow Methods

**Package:** `@mastra/core/workflows` (fluent API on workflow builder)

#### `.then(step)` — Sequential execution
Chains steps so each step receives the previous step's output as its `inputData`. The first step's inputSchema must match workflow inputSchema; the last must match workflow outputSchema.

#### `.parallel([step1, step2, ...])` — Fan-out / fan-in
Runs all steps simultaneously. Output is an object keyed by step `id`. All branches must complete before the next step runs. No concurrency limit option (all run simultaneously).

#### `.branch([[conditionFn, step], ...])` — Conditional routing
Evaluates async condition functions in order; only the first matching branch executes. Output is keyed by the executed step's `id`; subsequent steps should use optional fields to handle any branch.

#### `.foreach(step, { concurrency?: number })` — Map over arrays
Runs the same step for each item in an input array. Default `concurrency: 1` (sequential). Supports nested workflows as steps for multi-step-per-item pipelines (better than chained `.foreach()`).

#### `.dowhile(step, conditionFn)` — Loop while true
Runs step repeatedly while condition returns true.

#### `.dountil(step, conditionFn)` — Loop until true
Runs step repeatedly until condition returns true. Use `iterationCount` in the condition to abort after N iterations.

#### `.map(async ({ inputData, getStepResult, getInitData, mapVariable }) => ...)` — Data transformation
Transforms data between steps when schemas don't match. Helper functions: `getStepResult(stepId)`, `getInitData()`, `mapVariable()`.

#### `.sleep(ms)` — Timed pause
Pauses workflow execution for N milliseconds, setting status to `waiting`.

#### `.sleepUntil(date)` — Wait until date
Pauses until a specific Date.

#### `.commit()` — Seal the workflow
Finalizes the workflow definition. Must be called before running.

**FOSS candidates (control-flow is native to Mastra; webular's FOSS layer is about what runs inside steps):**
- None needed — these are Mastra's built-in primitives

---

### 3. Workflow Run Methods

**Package:** `@mastra/core/workflows`

#### `workflow.createRun({ runId?, resourceId?, disableScorers? })` → `Run`
Creates a new run instance. `resourceId` associates the run with a user/tenant.

#### `run.start({ inputData, requestContext?, initialState?, outputWriter?, tracingContext?, metadata? })` → `WorkflowResult`
Runs all steps and returns the final result. Awaits completion.

**Result discriminated union on `status`:**
- `success` → `result` (typed output)
- `failed` → `error`
- `suspended` → `suspendPayload`, `suspended` (step paths)
- `tripwire` → `tripwire.reason`, `tripwire.processorId`, `tripwire.retry`
- `paused`

Common fields on all: `steps`, `input`, optionally `state`.

#### `run.stream({ inputData, ... })` → `AsyncIterable<WorkflowChunk>`
Fire-and-forget streaming. Iterate `stream.fullStream` for lifecycle events; await `stream.result` for the final result. Event types include `workflow-start`, step start/finish, agent chunks.

#### `run.startAsync({ inputData, initialState?, ... })` → `{ runId }`
Fire-and-forget. Returns immediately. Poll with `workflow.getWorkflowRunExecutionResult(runId)`.

#### `run.resume({ step, resumeData, requestContext?, forEachIndex?, ... })` → `WorkflowResult`
Resume a suspended workflow. Pass `step` as object (type-safe) or string ID. `forEachIndex` targets a specific `.foreach()` iteration.

#### `run.restart()` — Restart from last active step
Used when a long-running workflow loses its server connection.

#### `workflow.restartAllActiveWorkflowRuns()` — Bulk restart
Restart all active (running or waiting) runs of this workflow.

#### `workflow.listActiveWorkflowRuns()` → `{ runs }` 
List currently running or waiting runs.

#### `workflow.getWorkflowRunById(runId)` → stored snapshot
Retrieve a persisted run for recovery. Use with `createWorkflowStateReader()`.

---

### 4. Workflow State

**Package:** `@mastra/core/workflows`  
**Purpose:** Shared mutable store across all steps in a run. Persists through suspend/resume cycles.

- `stateSchema` on workflow and step — Zod schema; step declares the subset it needs
- `state` — current state in execute
- `setState(newState)` — update state (reducer pattern: `setState({ ...state, ...newState })`)
- `initialState` — pass to `run.start()` to seed the state
- State propagates from parent to nested (child) workflows

**FOSS candidates:** None — native Mastra primitive.

---

### 5. Suspend & Resume

**Purpose:** Pause a workflow step mid-execution to wait for external input (HITL, API callbacks, throttling). State is snapshotted to storage.

In `execute`:
- `suspend(payload?, { resumeLabel? })` — pauses; payload accessible to resume handlers
- `resumeData` — data passed to `run.resume()`
- `suspendData` — original suspend payload accessible when step is resumed
- `bail(payload?)` — exit early with success (no error, no further steps)

Define on step: `resumeSchema`, `suspendSchema` for type safety.

Recover from storage:
```ts
import { createWorkflowStateReader } from '@mastra/core/workflows'
const reader = createWorkflowStateReader(state)
reader.getSuspendedStep()
reader.getResumeLabel('approve')
```

**FOSS candidates:** Storage adapters for persistence:
- `@mastra/libsql` (npm) — LibSQL/Turso storage (required for scheduled/evented workflows)
- `@mastra/pg` (npm) — PostgreSQL storage

---

### 6. Scheduled Workflows

**Purpose:** Run a workflow on a cron schedule without a separate scheduler service. Declared on `createWorkflow({ schedule: { cron, timezone, inputData } })`.

**Key fields:**
- `schedule.cron: string` — 5-, 6-, or 7-part cron expression (validated at construction)
- `schedule.timezone?: string` — IANA timezone (e.g., `America/New_York`)
- `schedule.inputData?: TInput` — payload for every fire
- `schedule.initialState?: TState`
- `schedule.requestContext?: Record<string, unknown>`
- `schedule.metadata?: Record<string, unknown>`
- Array form: `schedule: [{ id, cron, ... }, ...]` — multiple cadences on one workflow

Pause/resume schedules at runtime:
```ts
await client.pauseSchedule('wf_daily-report')
await client.resumeSchedule('wf_daily-report')
// HTTP: POST /api/schedules/:scheduleId/pause|resume
```

**Deployment:** Built-in scheduler uses `setInterval` — requires a long-lived process (Fly, Railway, ECS). For serverless (Vercel, Lambda), use `@mastra/inngest`.

**FOSS candidates:**
- `node-cron` (npm) — standalone cron if not using Mastra scheduler
- `@mastra/inngest` (npm) — Inngest-backed scheduler for serverless

---

### 7. Error Handling

**Purpose:** Resilient workflow execution with retries, lifecycle hooks, and conditional fallbacks.

- `retryConfig: { attempts: number, delay: number }` on `createWorkflow` — workflow-level
- `retries: number` on `createStep` — step-level override
- `onFinish(result)` / `onError(errorInfo)` on workflow options — lifecycle callbacks
  - Callback errors are caught+logged; don't fail the workflow
- `bail({ ... })` in execute — exit early with success
- `throw new Error(...)` in execute — fail the step and workflow
- `getStepResult(step)` in execute — inspect earlier step output for conditional logic
- `.branch([[cond, step]])` — route to fallback steps based on prior step status

**FOSS candidates:** None specific — native Mastra. For external retry libraries:
- `p-retry` (npm) — inside step execute functions for individual fetch calls
- `got` (npm) — HTTP client with built-in retry

---

### 8. Agents — `Agent` class

**Package:** `@mastra/core/agent`  
**Purpose:** LLM-powered reasoning unit that calls tools, maintains memory, and iterates to completion.

**Constructor params:**
- `id?: string`, `name: string`, `description?: string`
- `instructions: SystemMessage | ((ctx) => SystemMessage)` — string, array, or dynamic function
- `model: MastraLanguageModel | ((ctx) => model)` — `'provider/model-name'` string
- `tools?: ToolsInput | ((ctx) => ToolsInput)`
- `agents?: Record<string, Agent>` — subagents (supervisor pattern)
- `workflows?: Record<string, Workflow>` — workflows as tools (prefixed `workflow-<key>`)
- `memory?: MastraMemory` — conversation persistence
- `inputProcessors?`, `outputProcessors?` — guardrails / content moderation
- `maxProcessorRetries?: number`
- `scorers?: MastraScorers` — evaluation scorers
- `voice?: CompositeVoice`
- `requestContextSchema?: StandardJSONSchemaV1`
- `backgroundTasks?: { tools: { [key]: { enabled, timeoutMs } } }`

**Methods:**
- `agent.generate(messages, options?)` → `{ text, object, toolCalls, toolResults, steps, usage, finishReason, messages, response }`
- `agent.stream(messages, options?)` → `{ textStream, text, toolCalls, toolResults, steps, usage, fullStream }`
- `agent.streamUntilIdle(messages, options?)` — keeps stream open until background tasks finish
- `agent.network(message, options?)` — (deprecated) multi-agent routing (use supervisor instead)
- `agent.sendMessage(message, options)` — inject user message into active/idle thread
- `agent.queueMessage(message, options)` — queue message for next turn
- `agent.sendSignal(signal, options)` — send system signal (notification, state, reactive, etc.)
- `agent.subscribeToThread(options)` → `{ stream, activeRunId(), abort(), unsubscribe() }`

**Key generate/stream options:**
- `maxSteps?: number` — cap LLM iterations (default 5)
- `toolChoice?: 'auto'|'none'|'required'|{type:'tool',toolName}`
- `activeTools?: string[]` — restrict which tools can fire
- `memory?: { thread, resource, options? }` — conversation history
- `structuredOutput?: { schema, model?, errorStrategy?, fallbackValue? }` — typed JSON output
- `delegation?: { onDelegationStart, onDelegationComplete, messageFilter }` — supervisor hooks
- `isTaskComplete?: { scorers, strategy, onComplete }` — loop until task scored complete
- `onIterationComplete?: (ctx) => { continue?, feedback? }` — per-iteration control
- `requireToolApproval?: boolean` — HITL gate on tool calls
- `autoResumeSuspendedTools?: boolean` — auto-resume via next user message
- `modelSettings?: { temperature, maxOutputTokens, topP, topK, presencePenalty, frequencyPenalty, stopSequences }`
- `providerOptions?: { openai?, anthropic?, google?, ... }`
- `abortSignal?: AbortSignal`
- `versions?: { agents: { [id]: { versionId? | status? } } }`

**FOSS candidates for agent internals:**
- `ollama` (npm/binary) — local LLM provider (no paid API)
- `llamafile` (binary) — single-file local model server
- `lmstudio` (app + npm) — local model server with OpenAI-compatible API

---

### 9. Supervisor Agents (Multi-agent)

**Package:** `@mastra/core/agent` (v1.8.0+)  
**Purpose:** A coordinator agent that delegates to specialized subagents, each exposed as a tool named `agent-<key>`.

**Key features:**
- `delegation.onDelegationStart(ctx)` → `{ proceed, modifiedPrompt?, modifiedMaxSteps?, rejectionReason? }`
- `delegation.onDelegationComplete(ctx)` → `{ feedback? }` or `ctx.bail()`
- `delegation.messageFilter({ messages, primitiveId, prompt })` → filtered messages
- `includeSubAgentToolResultsInModelContext?: boolean`
- `onIterationComplete(ctx)` → `{ continue?, feedback? }`
- `isTaskComplete: { scorers, strategy, onComplete }` — automatic completion detection
- Memory isolation: subagents get full context but save only their delegation exchange
- `streamUntilIdle()` for background subagent tasks
- Tool approval propagation through delegation chain

---

### 10. `createTool`

**Package:** `@mastra/core/tools`  
**Purpose:** Define typed tool functions agents can call. This is the FOSS-friendly primitive — the execute function does any deterministic work (fetch, parse, scrape, compute).

**Params:**
- `id: string`, `description: string`
- `inputSchema?: StandardJSONSchemaV1`, `outputSchema?: StandardJSONSchemaV1`
- `strict?: boolean` — strict tool input enforcement (on supported providers)
- `requireApproval?: boolean` — HITL gate
- `resumeSchema?, suspendSchema?` — for suspendable tools
- `toModelOutput?: (output) => { type: 'text'|'json'|'content', value: ... }` — transform output for model context (e.g., include images)
- `transform?: { display: { input, output, error }, transcript: { input, output, error } }` — redact sensitive data from UI/transcript
- `mcp?: { annotations: { title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint }, _meta }` — MCP annotations
- `requestContextSchema?: StandardJSONSchemaV1`
- `execute: async (inputData, context?) => output`
  - `context.requestContext`, `context.tracingContext`, `context.abortSignal`, `context.agent`, `context.workflow`, `context.mcp`
- Lifecycle hooks: `onInputStart`, `onInputDelta` (streaming delta), `onInputAvailable`, `onOutput`

**FOSS candidates for what runs INSIDE tool execute:**

#### Web Fetch / HTTP
- `bun` — built-in `fetch()`, `HTMLRewriter` (streaming HTML transforms), `$` shell
- `node-fetch` (npm)
- `undici` (npm) — Node.js HTTP/1.1 + HTTP/2 client (Node built-in)
- `got` (npm) — HTTP client with retry/timeout

#### HTML Parsing / Scraping
- `cheerio` (npm) — jQuery-style HTML parsing, no browser
- `@mozilla/readability` (npm) — extract main article content from HTML (like Firefox Reader Mode)
- `turndown` (npm) — HTML → Markdown conversion
- `jsdom` (npm) — full DOM emulation
- `linkedom` (npm) — lightweight DOM (faster than jsdom)
- `htmlparser2` (npm) — fast low-level HTML parser

#### Browser Automation (JS-rendered pages)
- `playwright` (npm) — Chromium/Firefox/WebKit automation, screenshots, PDF
- `puppeteer` (npm) — Chromium automation
- `crawlee` (npm) — production web crawling framework (uses playwright/puppeteer internally)

#### PDF Parsing
- `pdf-parse` (npm) — extract text from PDF buffers
- `pdfjs-dist` (npm) — Mozilla PDF.js, full-featured
- `unpdf` (npm) — lightweight PDF text extraction
- `pdf2json` (npm) — PDF → JSON with layout info

#### Web Crawling / BFS Crawlers
- `crawlee` (npm) — Apify's crawling library (CheerioCrawler, PlaywrightCrawler, concurrency management)
- `node-crawler` (npm) — configurable crawler with cheerio integration
- `simplecrawler` (npm) — BFS crawler, respects robots.txt
- `playwright` — used directly with a URL queue for simple crawls
- Custom BFS with `undici`/`fetch` + `cheerio` for link extraction

#### Sitemap Parsing
- `sitemapper` (npm) — parse sitemap.xml files (supports sitemap index)
- `sitemap` (npm) — generate and parse sitemaps
- `xml2js` (npm) — parse sitemap XML manually

#### Structured Data Extraction
- `unstructured` (pypi / REST API with FOSS self-host) — document parsing (PDF, DOCX, HTML, images)
- `cheerio` — CSS selector-based extraction from HTML
- `css-select` (npm) — CSS selectors on parsed HTML trees
- `zod` (npm) — validate and transform extracted data schemas

#### Markdown / Content Cleaning
- `turndown` (npm) — HTML → Markdown
- `marked` (npm) — Markdown → HTML
- `remark`/`rehype` (npm) — Markdown/HTML AST processing
- `sanitize-html` (npm) — strip dangerous HTML
- `DOMPurify` (npm) — browser-side HTML sanitizer

#### Screenshot
- `playwright` — `page.screenshot({ fullPage: true })` to PNG/JPEG
- `puppeteer` — `page.screenshot()`

---

### 11. MCP (Model Context Protocol)

**Package:** `@mastra/mcp`  
**Purpose:** Universal plugin system. `MCPClient` connects Mastra to external MCP servers (tools from any provider). `MCPServer` exposes Mastra agents/tools/workflows to external systems.

**`MCPClient`:**
- Config: `servers: { [name]: { command, args, env } | { url, requestInit, headers } }`
- `mcp.listTools()` → flat tool list for static agent config
- `mcp.listToolsets()` → per-server toolsets for dynamic/per-user config
- `mcp.disconnect()`
- `requireToolApproval: true | ((context) => boolean)` — HITL gate per server
- OAuth support via `requestInit.headers`
- Registries: Klavis AI, mcp.run, Composio, Smithery, Apify, Ampersand

**`MCPServer`:**
- Config: `id, name, version, agents, tools, workflows`
- Exposes over HTTP(S) with MCP protocol
- MCP Apps: serve HTML UIs via `ui://` resources, rendered as iframes in Studio

**Register in Mastra instance:**
```ts
new Mastra({ mcpServers: { testMcpServer } })
```

**FOSS candidates for MCP tool servers (no paid API):**
- `@modelcontextprotocol/server-filesystem` (npm) — filesystem MCP server
- `@modelcontextprotocol/server-fetch` (npm) — HTTP fetch MCP server
- `@modelcontextprotocol/server-github` (npm) — GitHub MCP server (uses GitHub token, free tier)
- `wikipedia-mcp` (npm via npx) — Wikipedia lookup
- Any MCP-compatible server via stdio transport (run locally)

---

### 12. RAG — Retrieval-Augmented Generation

**Packages:** `@mastra/rag`, `@mastra/pg` (and other vector adapters)  
**Purpose:** Process documents into chunks, embed them, store in vector DB, query for similar context.

**Core classes/functions:**
- `MDocument.fromText(text)`, `MDocument.fromHTML(html)`, `MDocument.fromMarkdown(md)`, `MDocument.fromPDF(buffer)`
- `doc.chunk({ strategy: 'recursive'|'sliding'|'token'|..., size, overlap })` → `Chunk[]`
- `embedMany({ values: string[], model })` from Vercel AI SDK — batch embedding
- `embedOne({ value: string, model })` — single embedding
- Vector store: `pgVector.upsert({ indexName, vectors, metadata? })`, `pgVector.query({ indexName, queryVector, topK, filter? })`
- `ModelRouterEmbeddingModel('openai/text-embedding-3-small')` — embedding model via Mastra model router
- Graph RAG: `@mastra/rag` includes graph-based retrieval
- Reranking: `@mastra/rag` `rerankWithScorer` function
- Document chunker tool: `@mastra/core` `document-chunker-tool` for use in agents
- Vector query tool: `@mastra/core` `vector-query-tool` for semantic search in agents

**Vector stores supported:**
- `@mastra/pg` — pgvector (PostgreSQL)
- `@mastra/pinecone` — Pinecone
- `@mastra/qdrant` — Qdrant
- `@mastra/mongodb` — MongoDB Atlas Vector Search
- `@mastra/chroma` — Chroma
- `@mastra/elasticsearch` — Elasticsearch
- `@mastra/opensearch` — OpenSearch
- `@mastra/libsql` — LibSQL vector
- `@mastra/duckdb` — DuckDB
- `@mastra/upstash` — Upstash Vector
- `@mastra/astra` — DataStax Astra
- `@mastra/turbopuffer` — Turbopuffer
- `@mastra/s3vectors` — AWS S3 Vectors
- `@mastra/vectorize` — Cloudflare Vectorize
- `@mastra/convex` — Convex
- `@mastra/couchbase` — Couchbase
- `@mastra/lance` — LanceDB
- `@mastra/mongodb` — MongoDB

**FOSS candidates for RAG building blocks:**

#### Chunking
- `@mastra/rag` (built-in) — recursive, sliding window, token strategies
- `langchain` (npm) — `RecursiveCharacterTextSplitter`, `TokenTextSplitter`
- `llm-chunk` (npm) — semantic chunking
- `text-splitter` (npm)

#### Embeddings (no paid API)
- `@xenova/transformers` (npm) — ONNX-based local embeddings (no API needed)
- `ollama` — local embedding models (nomic-embed-text, mxbai-embed-large)
- `fastembed-js` (npm) — fast local embeddings
- `node-llama-cpp` (npm) — local llama.cpp inference for embeddings

#### Vector Stores (FOSS, self-hosted)
- `@mastra/pg` + pgvector extension (PostgreSQL) — full FOSS
- `@mastra/chroma` + ChromaDB self-hosted
- `@mastra/qdrant` + Qdrant self-hosted
- `@mastra/elasticsearch` + Elasticsearch FOSS
- `@mastra/opensearch` + OpenSearch FOSS
- `@mastra/duckdb` — embedded (no server)
- `@mastra/lance` + LanceDB (embedded or server)
- `vectra` (npm) — in-process vector DB, no server

---

### 13. Streaming

**Package:** `@mastra/core/agent`, `@mastra/core/workflows`  
**Purpose:** Real-time incremental output from agents and workflows.

**Agent streaming:**
- `agent.stream(messages, options?)` — for AI SDK v5 (LanguageModelV2) models
- `agent.streamLegacy(messages, options?)` — for AI SDK v4 (LanguageModelV1) models
- `agent.streamUntilIdle(messages, options?)` — stay open until background tasks finish
- Properties: `textStream` (AsyncIterable<string>), `text` (Promise<string>), `finishReason`, `usage`, `fullStream`, `toolCalls`, `toolResults`, `steps`

**Workflow streaming:**
- `run.stream({ inputData, ... })` — returns event stream
- Properties: `stream.fullStream` (all events), `stream.result` (final WorkflowResult), `stream.status`, `stream.usage`
- Event types: `workflow-start`, step-start, step-finish, `workflow-finish`, agent text chunks, tool-call, tool-result

**AI SDK interop:**
- `toAISdkV5Stream(stream, { from: 'agent'|'workflow' })` from `@mastra/ai-sdk`
- `toAISdkV5Messages(messages)` from `@mastra/ai-sdk/ui`

**Workflow streaming (streaming by step):**
- `docs/streaming/workflow-streaming` — per-step streaming from workflow runs
- `docs/streaming/background-task-streaming` — streaming from long-running background tasks
- `docs/streaming/tool-streaming` — streaming tool output incrementally

**FOSS candidates for consuming streams:**
- `eventsource-parser` (npm) — parse SSE streams
- `ai` (npm, Vercel AI SDK) — `readStreamableValue`, `useStreamableValue`, `createStreamableValue`
- Node.js built-in `ReadableStream`, `TransformStream`

---

### 14. Request Context

**Package:** `@mastra/core/request-context`  
**Purpose:** Per-request scoped key-value store for dynamic configuration, injected into step/tool/agent execute functions.

```ts
const ctx = new RequestContext()
ctx.set('user-tier', 'enterprise')
const tier = ctx.get('user-tier')
```

Used for: per-request model selection, per-user feature flags, conditional tool behavior, rate-limiting tiers.

**FOSS candidates:** `AsyncLocalStorage` (Node.js built-in) — underlies similar patterns.

---

### 15. Workflow Snapshots & Time Travel

**Packages:** `@mastra/core/workflows`, storage adapter  
**Purpose:** Persist complete execution state at each step. Resume from any snapshot. Replay/rerun individual steps in Studio.

- Snapshots stored in configured storage adapter
- `createWorkflowStateReader(state)` — read snapshots without raw shape knowledge
- Time travel: replay any step in Studio with modified inputs
- `run-methods/timeTravel` — HTTP API for time travel

**FOSS candidates:**
- `@mastra/libsql` / `@mastra/pg` — persistence backends

---

## Summary Table of Key Primitives for Webular

| Feature | Mastra API | FOSS alternatives for the work inside |
|---------|------------|--------------------------------------|
| Pipeline definition | `createWorkflow`, `createStep` | — (native) |
| Sequential steps | `.then(step)` | — (native) |
| Parallel execution | `.parallel([])` | `p-all` (npm) |
| Conditional routing | `.branch([[cond, step]])` | — (native) |
| Map over arrays | `.foreach(step, { concurrency })` | `p-map` (npm) |
| Loop until/while | `.dountil/.dowhile` | — (native) |
| Data transform | `.map(fn)` | — (native) |
| Timed wait | `.sleep(ms)`, `.sleepUntil(date)` | `setTimeout` |
| Run workflow | `run.start()`, `run.stream()`, `run.startAsync()` | — (native) |
| Suspend / HITL | `suspend()`, `run.resume()` | — (native) |
| Scheduled runs | `schedule: { cron }` on createWorkflow | `node-cron` (npm) |
| Retry | `retryConfig`, `retries` per step | `p-retry` (npm) |
| LLM agent | `new Agent({ model, tools })`, `agent.generate()` | `ollama` (local LLM) |
| Supervisor | `agents: { subagent }` on Agent | — (native) |
| Tool definition | `createTool({ execute })` | — (native) |
| HTTP fetch in tool | `fetch()` (Bun/Node built-in) | `got`, `undici` |
| HTML scrape | cheerio, @mozilla/readability | `cheerio` (npm), `@mozilla/readability` (npm) |
| Browser render | playwright, puppeteer (via tool) | `playwright` (npm) |
| Web crawl | crawlee (via tool) | `crawlee` (npm) |
| Sitemap parse | sitemapper (via tool) | `sitemapper` (npm) |
| PDF extract | pdf-parse (via tool) | `pdf-parse` (npm) |
| HTML→Markdown | turndown (via tool) | `turndown` (npm) |
| Document chunk | `MDocument.chunk()` | `langchain` text splitters |
| Embed (local) | `@xenova/transformers` (via tool) | `@xenova/transformers` (npm) |
| Vector store (FOSS) | `@mastra/pg` + pgvector | pgvector + `@mastra/pg` |
| MCP client | `MCPClient` | `@modelcontextprotocol/client` (npm) |
| MCP server | `MCPServer` | `@modelcontextprotocol/server-*` (npm) |
| Streaming | `agent.stream()`, `run.stream()` | — (native) |

---

## Coverage Notes

- **Total URLs in inventory:** 1139
- **Deep reads completed:** 30 (all pre-selected pages successfully scraped)
- **Pages skipped:** 0 (all 30 returned content)
- The 30 deep-read pages cover the complete core primitives: workflows, agents, tools, MCP, RAG, streaming. Remaining URLs are mostly model providers (~130), blog/changelogs (~120), podcasts/workshops (~120), storage adapters (~30), evals (~25), auth (~15), voice (~15), editor/workspace (~20), and marketing pages — none of which add web feature primitives beyond what is already documented above.
