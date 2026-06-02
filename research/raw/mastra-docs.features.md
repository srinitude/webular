# Mastra Docs — Webular Feature Catalog

**Product:** Mastra (mastra.ai)
**Slug:** mastra-docs
**Coverage:** 30 deep-read pages out of 157 total URLs inventoried
**Date:** 2026-06-02

---

## Purpose of this document

Mastra is a TypeScript AI agent/workflow framework that webular will **build with** — not a data service webular wraps. This document catalogs the Mastra primitives that are directly relevant to implementing webular's web-scrape/research/crawl/map/extract/summarize pipeline.

The features are grouped into:
1. **Workflow primitives** — non-model, deterministic execution control
2. **Agent primitives** — LLM-calling patterns with tools, processors, memory
3. **MCP integration** — plugin tool system
4. **Streaming** — real-time output from agents and workflows
5. **Server / HTTP** — exposing and consuming the Mastra runtime
6. **Memory** — persistent state across calls
7. **URL inventory bucket analysis** — full classification of all 157 doc URLs

---

## 1. Workflow Primitives

### 1.1 `createStep` — Typed Workflow Step

**Category:** workflow/control-flow
**Source:** `@mastra/core/workflows`

**Purpose:** Define a single deterministic unit of work in a pipeline. Each step has typed input, output, and optionally state schemas. The `execute` function can call any async code: fetchers, parsers, agents, tools, or other steps.

**Key params:**
- `id` (string) — unique step identifier; used as key in parallel/branch output objects
- `inputSchema` (StandardJSON / Zod / Valibot / ArkType)
- `outputSchema` (same)
- `stateSchema` — subset of workflow-level shared state this step reads/writes
- `resumeSchema` — data required to resume if step suspends
- `suspendSchema` — payload attached to a suspension event
- `execute: async ({ inputData, state, setState, suspend, bail, getStepResult, mastra, requestContext, writer }) => output`
- `retries` (number) — per-step retry count; overrides workflow-level `retryConfig`

**FOSS candidates:** none (this is the framework API itself); internally powered by schema validation: `zod`, `valibot`, `arktype`

---

### 1.2 `createWorkflow` — Typed Workflow Composition

**Category:** workflow/control-flow
**Source:** `@mastra/core/workflows`

**Purpose:** Compose steps into an execution graph with typed I/O. Provides a fluent builder API.

**Key params:**
- `id` — workflow identifier (used as key in Mastra instance)
- `inputSchema`, `outputSchema`
- `stateSchema` — master schema for shared workflow state; each step uses a subset
- `retryConfig: { attempts, delay }` — workflow-level retry defaults
- `schedule: { cron, timezone, inputData, initialState, requestContext, metadata }` or array of same — declarative cron scheduling (see §1.8)
- `options.onFinish(result)` — lifecycle callback for all terminal states
- `options.onError(errorInfo)` — lifecycle callback for failures only
- `requestContextSchema` — validates request context at `run.start()`
- `.then(step | workflow)` — sequential chaining
- `.parallel([...steps])` — fan-out; all complete before next step
- `.foreach(step, { concurrency? })` — map over an array; each element runs through the step
- `.branch([[condition, step], ...])` — conditional routing; first matching condition wins
- `.map(async ({ inputData, getStepResult, getInitData, mapVariable }) => shape)` — data transformation between steps
- `.dowhile(step, condition)` — loop while condition is true
- `.dountil(step, condition)` — loop until condition becomes true
- `.sleep(ms)` / `.sleepUntil(date)` — workflow-level pause (sets status `waiting`)
- `.commit()` — finalize and return the workflow object
- `cloneWorkflow(workflow, { id })` — create an independently-tracked clone

**FOSS candidates:** for schema: `zod`, `valibot`, `arktype`; for cron: `node-cron`, `croner`, `cron-parser`

---

### 1.3 Workflow Run Execution

**Category:** workflow/execution

**Purpose:** Run a committed workflow, handle results, and stream progress.

**Key params / methods:**
- `workflow.createRun({ runId? })` → `run`
- `run.start({ inputData, initialState?, requestContext? })` → `Promise<WorkflowResult>`
- `run.stream({ inputData, initialState?, requestContext? })` → streaming run; iterate `fullStream`
- `run.resume({ step, resumeData, forEachIndex? })` — resume a suspended run
- `run.resumeStream(...)` — resume and stream
- `run.timeTravel({ step, inputData?, context?, nestedStepsContext?, initialState?, resumeData? })` — re-execute from a specific step with optional new context
- `run.timeTravelStream(...)` — streaming version of time travel
- `run.restart()` — restart an active run from last active step
- `workflow.restartAllActiveWorkflowRuns()`
- `workflow.listActiveWorkflowRuns()` → `{ runs }`
- `workflow.getWorkflowRunById(runId)` → snapshot state

**Result statuses:** `success`, `failed`, `suspended`, `tripwire`, `paused`
**Result props:** `status`, `result`, `error`, `steps`, `input`, `state`, `suspendPayload`, `suspended`, `tripwire { reason, retry?, metadata?, processorId? }`

**FOSS candidates:** none (framework API); persistence via `@mastra/libsql` / `@mastra/pg` / `@mastra/upstash` / `@mastra/mongodb`

---

### 1.4 Workflow State (`stateSchema` / `setState` / `state`)

**Category:** workflow/state

**Purpose:** Share typed values across all steps without threading them through every inputSchema/outputSchema. Persists through suspend/resume cycles. Parent state propagates into nested workflow steps.

**Key params:**
- `stateSchema` on workflow (master) and each step (subset)
- `initialState` passed to `run.start()`
- `state` (read) and `setState(patch)` (write) in step execute function

**FOSS candidates:** none (framework built-in)

---

### 1.5 Suspend / Resume / Snapshots

**Category:** workflow/suspend-resume

**Purpose:** Pause a workflow step, persist full execution state as a serializable snapshot, resume from exact pause point with new input. Enables human-in-the-loop, rate-limit throttling, and long-running pipelines.

**Key params:**
- `suspend(payload)` in step execute — pauses, persists snapshot, returns suspended status
- `suspendData` in step execute — payload provided at original suspend time, available on resume
- `resumeData` — data matching `resumeSchema`, passed at resume time
- `createWorkflowStateReader(state)` — utility to inspect suspended steps, resume labels, payloads without raw snapshot schema
  - `reader.getSuspendedStep()`
  - `reader.getResumeLabel(labelName)`
- **Snapshot storage:** libSQL, PostgreSQL, MongoDB, Upstash, Cloudflare D1, DynamoDB
- **Snapshot anatomy:** `runId`, `status`, `context` (per-step payload/output/suspend/resume), `activePaths`, `serializedStepGraph`, `suspendedPaths`, `waitingPaths`, `result`, `requestContext`, `timestamp`
- **Sleep:** `.sleep(ms)` / `.sleepUntil(date)` — workflow-level pause (status `waiting`, not `suspended`)

**FOSS candidates:** snapshot storage backend: `better-sqlite3` (libSQL compat), `pg`, `redis` (Upstash compat); serialization: native `JSON.stringify`

---

### 1.6 Error Handling & Retries

**Category:** workflow/error-handling

**Purpose:** Handle transient failures, validate results, branch on errors.

**Key params:**
- `retryConfig: { attempts, delay }` on `createWorkflow()`
- `retries: number` on `createStep()` — overrides workflow-level
- `bail(payload)` in step execute — exit step successfully with early output, skip remaining steps
- `throw new Error()` in step execute — sets run status to `failed`
- `onFinish` / `onError` callbacks receive: `status`, `result`, `error`, `steps`, `tripwire`, `runId`, `workflowId`, `resourceId`, `getInitData()`, `mastra`, `requestContext`, `logger`, `state`
- `run.stream()` + iterate `stream.stream` to monitor errors during execution
- `getStepResult(step)` in map/execute — inspect previous step output for conditional branching

**FOSS candidates:** retry logic: `async-retry`, `p-retry`

---

### 1.7 Agents and Tools in Workflows

**Category:** workflow/agents-and-tools

**Purpose:** Call LLM agents or typed tools from within workflow steps; or compose agents/tools directly as steps.

**Key params:**
- `mastra.getAgent('id')` inside step execute — call agent with `.generate()` or `.stream()`
- `testTool.execute(input, { requestContext })` — call tool directly from step
- `createStep(agent)` — agent as a step; default schema: `{ prompt: string }` → `{ text: string }`
- `createStep(agent, { structuredOutput: { schema } })` — agent as step with typed output
- `createStep(tool)` — tool as a step; uses tool's inputSchema/outputSchema

**FOSS candidates:** none (framework composition API)

---

### 1.8 Scheduled Workflows

**Category:** workflow/scheduling

**Purpose:** Declare cron schedules directly on workflows. Built-in scheduler polls a DB table and dispatches runs. Supports multiple cron expressions per workflow, IANA timezone, runtime pause/resume, Studio visibility.

**Key params on `createWorkflow()`:**
- `schedule.cron` — 5/6/7-part cron expression
- `schedule.timezone` — IANA e.g. `America/New_York`
- `schedule.inputData` — payload for every scheduled run
- `schedule.initialState`
- `schedule.requestContext`
- `schedule.metadata`
- Array form for multiple schedules: each entry needs unique `id`

**Runtime control:**
- `client.pauseSchedule(scheduleId)` / `client.resumeSchedule(scheduleId)`
- HTTP: `POST /api/schedules/:scheduleId/pause` and `/resume`

**Topology:** built-in scheduler = `setInterval` tick loop; needs long-lived process. Serverless platforms require `@mastra/inngest` instead.

**FOSS candidates:** cron scheduling: `node-cron`, `croner`, `@breejs/later`; for durable execution: `inngest` (already supported), `bullmq`, `temporal`

---

### 1.9 Time Travel Debugging

**Category:** workflow/time-travel

**Purpose:** Re-execute a workflow from any specific step, optionally with custom context for previous steps. Useful for debugging, step-level testing, and recovering from transient failures.

**Key params:**
- `run.timeTravel({ step, inputData?, context?, nestedStepsContext?, initialState?, resumeData? })`
- `run.timeTravelStream(...)` — streaming version
- `step` can be: step reference, step ID string, dot notation for nested (`'nested.step3'`), or array

**FOSS candidates:** none (framework API)

---

## 2. Agent Primitives

### 2.1 `Agent` Class

**Category:** agent/core

**Purpose:** LLM-backed reasoning unit with tools, memory, processors, and structured output. Calls `.generate()` for complete responses or `.stream()` for incremental text.

**Key constructor params:**
- `id`, `name`, `description`
- `model` — `'provider/model-id'` via Mastra model router
- `instructions` — string or `async ({ requestContext }) => string` (dynamic)
- `tools: { [key]: createTool result }`
- `agents: { [key]: Agent }` — subagents; each becomes tool `agent-<key>`
- `workflows: { [key]: Workflow }` — each becomes tool `workflow-<key>`
- `memory: Memory | (({ requestContext }) => Memory)`
- `inputProcessors: Processor[] | (({ requestContext }) => Processor[])`
- `outputProcessors: Processor[]`
- `errorProcessors: Processor[]`
- `maxProcessorRetries`
- `backgroundTasks: { enabled, globalConcurrency, perAgentConcurrency, backpressure, defaultTimeoutMs, tools: { [toolKey]: { enabled, timeoutMs, maxRetries } | false } | 'all' }`
- `defaultOptions: { autoResumeSuspendedTools, maxSteps, ... }`
- `requestContextSchema` — validates request context at generate/stream time

**Key methods:**
- `.generate(prompt, options)` → `FullOutput { text, toolCalls, toolResults, steps, usage, object?, response }`
- `.stream(prompt, options)` → `MastraModelOutput { textStream, text, fullStream, finishReason, usage, runId, ... }`
- `.streamUntilIdle(prompt, options)` → keeps stream open until all background tasks complete
- `options` common to generate/stream: `toolChoice`, `activeTools`, `toolsets`, `clientTools`, `structuredOutput`, `maxSteps`, `prepareStep`, `memory`, `requestContext`, `inputProcessors`, `outputProcessors`, `requireToolApproval`, `abortSignal`

**FOSS candidates:** none (framework API); model providers via AI SDK v5 adapters

---

### 2.2 `createTool` — Typed Tool

**Category:** agent/tools

**Purpose:** Define a typed callable action for an agent. Tools have schemas, execute functions, and optional approval/streaming/caching/transform hooks.

**Key params:**
- `id`, `description`
- `inputSchema`, `outputSchema`
- `resumeSchema`, `suspendSchema` — for tools that call `suspend()`
- `requireApproval: boolean` — pause before execution for human approval
- `execute: async (inputData, context) => output`
  - `context.mastra` — Mastra instance
  - `context.requestContext`
  - `context.writer` — writable stream for incremental output (`writer.write(chunk)`, `writer.custom(chunk)`, `transient: true`)
  - `context.agent.suspend(payload)`, `context.agent.resumeData`
- `toModelOutput(output)` — shape the payload the LLM sees (can include images, text, etc.)
- `transform` — reshape tool input/output/errors for `display` and `transcript` targets
- `onInputAvailable`, `onInputDelta`, `onInputStart`, `onOutput` — lifecycle hooks
- `backgroundTasks: { enabled, timeoutMs, maxRetries, onComplete, onFailed }`
- `requestContextSchema`

**FOSS candidates:** schema validation: `zod`, `valibot`, `arktype`; HTTP inside execute: native `fetch`

---

### 2.3 Structured Output

**Category:** agent/structured-output

**Purpose:** Force agent to return a typed object matching a schema instead of plain text. Works with generate and stream.

**Key params on `.generate()` / `.stream()`:**
- `structuredOutput.schema` — Zod/Valibot/ArkType/JSON Schema
- `structuredOutput.model` — optional second LLM for extraction pass
- `structuredOutput.useAgent: boolean` — second LLM inherits conversation memory
- `structuredOutput.jsonPromptInjection: boolean` — inject schema into prompt instead of using API `response_format` (required for Gemini 2.5 + tools)
- `structuredOutput.errorStrategy: 'strict' | 'warn' | 'fallback'`
- `structuredOutput.fallbackValue`

**Result props:** `response.object` (generate) or `stream.object` promise + `stream.fullStream` `object-result` chunks

**FOSS candidates:** schema: `zod`; JSON extraction fallback: `jsonrepair`, `json-schema-to-zod`

---

### 2.4 Processors (Input / Output)

**Category:** agent/processors

**Purpose:** Transform, validate, guard, or control messages in the agent pipeline. `inputProcessors` run before LLM; `outputProcessors` run after. Can be individual Processor objects or Mastra workflows.

**Processor interface methods:**
- `processInput({ messages, systemMessages, abort, messageList })` → messages — runs once before agentic loop
- `processInputStep({ stepNumber, model, tools, toolChoice, messages, systemMessages, messageList, sendSignal })` → step config overrides — runs at each loop step
- `processLLMRequest({ prompt, model, stepNumber, state, abort })` → modified prompt — runs immediately before provider call; changes are transient
- `processLLMResponse({ chunks, model, stepNumber, state, fromCache, abort })` — runs after provider call completes
- `processOutputResult({ messages, result, writer })` → messages — runs after full generation
- `processOutputStream({ part, state, abort })` → chunk | null — filters/modifies stream chunks; set `processDataParts = true` to receive `data-*` chunks
- `processOutputStep({ text, abort, retryCount })` — validate per-step, optionally request retry
- `processAPIError({ error, messageList, retryCount })` — handle API rejections (400/422)

**Built-in processors:**
- `TokenLimiter(maxTokens)` — removes older messages to fit context window; custom encoding/strategy/count-mode options
- `ToolCallFilter({ filterAfterToolSteps?, preserveModelOutput? })` — removes tool calls from LLM input to save tokens
- `ToolSearchProcessor` — dynamic tool discovery with `search_tools` and `load_tool` meta-tools for large tool libraries
- `ProviderHistoryCompat` — handles cross-provider message history incompatibilities, reactive API error recovery
- `ModerationProcessor({ model, categories, threshold, strategy })` — LLM-based content moderation
- `ResponseCache({ cache, ttl?, scope?, key? })` — cache identical LLM calls; see §2.5
- `PrefillErrorHandler` — auto-handles Anthropic prefill errors (auto-injected)

**abort() options:** `{ retry: boolean, metadata: object }` — retry asks agent to retry with feedback

**FOSS candidates:** token counting: `tiktoken`, `gpt-tokenizer`; moderation: locally via `transformers.js` / ONNX classifier; content filtering: rule-based regex; caching backend: `ioredis`, `lru-cache`

---

### 2.5 Response Caching

**Category:** agent/caching

**Purpose:** Skip LLM call and replay cached response for identical requests. Implemented as a `ResponseCache` input processor.

**Key params:**
- `new ResponseCache({ cache: MastraServerCache, ttl?, scope?, key? })`
- Backends: `InMemoryServerCache` (dev), `RedisCache` from `@mastra/redis` (prod), or custom extending `MastraServerCache`
- Per-call overrides via `RequestContext`: `key`, `scope`, `bust`
- `ResponseCache.context({ key, scope, bust })` — build per-call context

**Cache key derivation:** `agentId + stepNumber + scope + model identity + resolved prompt` (post-memory/post-processors)

**FOSS candidates:** `ioredis` (Redis backend), `lru-cache` (in-memory), custom `MastraServerCache` with any KV store

---

### 2.6 Agent Approval (Human-in-the-Loop for Tools)

**Category:** agent/approval

**Purpose:** Pause tool execution before or during `execute()` for human approval. Propagates through supervisor delegation chains.

**Mechanisms:**
1. **Pre-execution:** `requireApproval: true` on tool definition, or `requireToolApproval: true | function` on `.stream()` / `.generate()` call
2. **Runtime suspension:** `context.agent.suspend(payload)` inside tool execute

**Stream chunks:** `tool-call-approval` (pre-exec) or `tool-call-suspended` (runtime)
**Methods:** `agent.approveToolCall({ runId, toolCallId? })`, `agent.declineToolCall(...)`, `agent.resumeStream(resumeData, { runId })`
**Generate equivalents:** `agent.approveToolCallGenerate(...)`, `agent.declineToolCallGenerate(...)`
**Auto-resumption:** `autoResumeSuspendedTools: true` — agent extracts resumeData from next user message on same thread

**FOSS candidates:** none (framework API)

---

### 2.7 Background Tasks

**Category:** agent/background-tasks

**Purpose:** Dispatch long-running tool calls without blocking the agentic loop. Tool returns acknowledgement immediately; task runs to completion in background; result is written to memory; agent can be re-invoked when done.

**Key params:**
- `Mastra({ backgroundTasks: { enabled, globalConcurrency, perAgentConcurrency, backpressure, defaultTimeoutMs, onTaskComplete, onTaskFailed } })`
- Tool-level: `backgroundTasks: { enabled, timeoutMs, maxRetries, onComplete, onFailed }`
- Agent-level: `backgroundTasks: { tools: { toolKey: config | false } | 'all', disabled?, waitTimeoutMs? }`
- LLM per-call: `_background` field in tool args (opt-in for already-enabled tools only)
- `agent.streamUntilIdle(prompt, { maxIdleMs? })` — keep stream open until all bg tasks complete
- `mastra.backgroundTaskManager.resume(taskId, resumeData)` — resume suspended bg task
- `mastra.backgroundTaskManager.cancel(taskId)`
- `mastra.backgroundTaskManager.stream()` — SSE stream of manager lifecycle events

**Stream chunks:** `background-task-started`, `background-task-running`, `background-task-progress`, `background-task-output`, `background-task-completed`, `background-task-failed`, `background-task-cancelled`, `background-task-suspended`, `background-task-resumed`

**FOSS candidates:** task queuing: `bullmq`; background processing: `workerpool`

---

### 2.8 Agent Signals (Experimental)

**Category:** agent/signals

**Purpose:** Send messages and system context into a running or idle agent thread without starting a new `agent.stream()` call each time.

**Key methods:**
- `agent.subscribeToThread({ resourceId, threadId })` → subscription with `.stream`
- `agent.sendMessage(content, { resourceId, threadId, ifActive?, ifIdle? })` — immediate delivery
- `agent.queueMessage(content, { resourceId, threadId })` — queued for next turn
- `agent.sendSignal(signal, { resourceId, threadId, ifActive?, ifIdle? })` — system context injection
  - Signal types: `notification` (external events), `reactive` (processor-generated)
  - Behavior: `deliver` (default), `persist`, `discard`

**FOSS candidates:** SSE transport: `eventsource-parser`; message queuing: `p-queue`

---

### 2.9 Agent Networks (Deprecated → Supervisor Agents)

**Category:** agent/multi-agent

**Purpose:** Coordinate multiple agents, workflows, and tools via a routing LLM. Deprecated in favour of supervisor agents (`agents` prop on `Agent`).

**Key methods:** `agent.network(prompt, options)` → stream; `approveNetworkToolCall()`, `declineNetworkToolCall()`, `resumeNetwork()`, `autoResumeSuspendedTools`

**FOSS candidates:** multi-agent orchestration: `langgraph` (external), custom workflow composition

---

## 3. MCP Integration

### 3.1 `MCPClient` — Connect to External MCP Servers

**Category:** mcp/client

**Purpose:** Connect Mastra agents to external Model Context Protocol servers for universal tool discovery.

**Key params:**
- `new MCPClient({ id, servers: { [name]: { command + args } | { url, requestInit?, requireToolApproval? } } })`
- `mcp.listTools()` → tools object for static `tools:` prop on Agent (single-user)
- `mcp.listToolsets()` → toolsets for per-request `toolsets:` in `.generate()` / `.stream()` (multi-tenant)
- `mcp.disconnect()`
- OAuth auth support for protected servers

**Registries supported:** Smithery, Composio, mcp.run, Klavis AI, Apify, Ampersand, and any SSE/stdio MCP server

**FOSS candidates:** MCP server protocol: `@modelcontextprotocol/sdk`; local tools via stdio: `npx`-run packages

---

### 3.2 `MCPServer` — Expose Mastra as MCP

**Category:** mcp/server

**Purpose:** Expose Mastra agents, tools, and workflows to any MCP-compatible client over HTTP(S).

**Key params:**
- `new MCPServer({ id, name, version, agents, tools, workflows })`
- Register with `Mastra({ mcpServers: { serverKey } })`
- OAuth protection support

**FOSS candidates:** `@modelcontextprotocol/sdk`

---

## 4. Streaming

### 4.1 Agent Streaming (`Agent.stream()`)

**Category:** streaming/agent

**Purpose:** Incremental token streaming from agents. Emits structured event chunks.

**Key stream properties:**
- `stream.textStream` — ReadableStream of text chunks
- `stream.text` — Promise resolving to full text
- `stream.finishReason`
- `stream.usage` — token counts
- `stream.fullStream` — all event chunks (text-delta, tool-call, tool-result, step-start, step-finish, finish, data-*)
- `stream.runId`

**Agent-level events:** `start`, `step-start`, `text-delta`, `tool-call`, `tool-result`, `step-finish`, `finish`, `tripwire`, `tool-call-approval`, `tool-call-suspended`, `background-task-*`

**AI SDK v5 compat:** `toAISdkV5Stream(stream, { from: 'agent' })` from `@mastra/ai-sdk`

**FOSS candidates:** SSE parsing: `eventsource-parser`; streaming utilities: `web-streams-polyfill`

---

### 4.2 Workflow Streaming (`Run.stream()`)

**Category:** streaming/workflow

**Purpose:** Receive structured lifecycle events as a workflow executes.

**Key stream properties:**
- `stream.status`, `stream.result`, `stream.usage`
- Event types: `workflow-start`, `workflow-step-start`, `workflow-step-finish`, `workflow-step-progress`, `workflow-finish`
- `run.resumeStream(...)` — re-subscribe to an interrupted workflow stream

**`workflow-step-progress`** (foreach iteration tracking): `id`, `completedCount`, `totalCount`, `currentIndex`, `iterationStatus`, `iterationOutput`

**FOSS candidates:** none (framework API)

---

### 4.3 Tool Streaming (`context.writer`)

**Category:** streaming/tools

**Purpose:** Tools push incremental updates into the active agent stream during execution.

**Key API:**
- `await context.writer.write({ type, ...data })` — push arbitrary chunk
- `await context.writer.custom({ type: 'data-*', data, transient? })` — push top-level stream chunk (persisted unless `transient: true`)
- `stream.fullStream.pipeTo(context.writer)` — pipe an agent stream into a tool's writer
- Lifecycle hooks: `onInputStart`, `onInputDelta`, `onInputAvailable`, `onOutput`

**FOSS candidates:** `WritableStream` / `TransformStream` from Web Streams API (built into Node 18+/Bun)

---

### 4.4 Workflow Step Streaming (`writer` arg)

**Category:** streaming/workflow-steps

**Purpose:** Workflow steps push incremental updates into the active workflow stream.

**Key API:**
- `await writer.write({ type, ...data })` inside step execute
- `await stream.textStream.pipeTo(writer)` — pipe agent text stream into step writer

**FOSS candidates:** same as §4.3

---

## 5. Server / HTTP

### 5.1 Mastra HTTP Server

**Category:** server/http

**Purpose:** Built-in Hono-based HTTP server exposing all registered agents, workflows, and MCP servers as REST endpoints.

**Key config (passed to `Mastra({ server: {} })`):**
- `port` (default `4111`), `host` (default `localhost`)
- `middleware: [async (ctx, next) => {}]` — global Hono middleware
- `apiRoutes: [registerApiRoute(...)]` — custom HTTP routes
- `auth` — JWT/Clerk/Supabase/Firebase/Auth0/WorkOS
- `build.openAPIDocs: boolean`, `build.swaggerUI: boolean`

**Auto-exposed endpoints:**
- `/api/agents/:agentId/generate` — POST
- `/api/agents/:agentId/stream` — POST (SSE)
- `/api/agents/:agentId/send-message` — POST
- `/api/agents/:agentId/queue-message` — POST
- `/api/workflows/:workflowId/...` — run, stream, resume
- `/api/schedules/:scheduleId/pause` + `/resume`
- `/api/openapi.json` — OpenAPI spec
- `/swagger-ui` — interactive API explorer
- OpenAI Responses API compatible routes (experimental): `/api/agents/:agentId/openai/responses`, conversations

**Stream data redaction:** system prompts, tool definitions, API keys are redacted before sending to clients by default.

**FOSS candidates:** HTTP server: `hono`, `express`, `fastify`; OpenAPI: `zod-openapi`, `swagger-jsdoc`

---

### 5.2 Custom API Routes (`registerApiRoute`)

**Category:** server/custom-routes

**Purpose:** Add arbitrary HTTP endpoints with full access to Mastra instance, request context, and middleware.

**Key params:**
- `registerApiRoute(path, { method, handler, middleware?, openapi?, requiresAuth? })`
- `handler: async (c: HonoContext) => Response`
- `openapi` — standard OpenAPI operation fields; Zod schemas auto-converted to JSON Schema
- `requiresAuth: false` — opt out of auth for this route
- `c.req.raw.signal` — forward to `agent.stream()` for disconnect-aware streaming
- `consumeStream()` — background consumption pattern for disconnect-tolerant generation

**FOSS candidates:** `hono`, `express`, `fastify`

---

### 5.3 Request Context

**Category:** server/request-context

**Purpose:** Pass request-specific typed values to agents, tools, and workflow steps. Enables dynamic instructions, model selection, tier-based behavior, and user isolation.

**Key API:**
- `new RequestContext<MyType>()`
- `ctx.set(key, value)`, `ctx.get(key)`, `ctx.all` (typed object), `ctx.keys()`, `ctx.entries()`
- `requestContextSchema` (Zod/etc.) on Agent, createTool, createWorkflow, createStep — validates at start of execution
- Reserved keys: `MASTRA_RESOURCE_ID_KEY` (forces memory resource), `MASTRA_THREAD_ID_KEY`
- Middleware pattern: populate from request headers in `server.middleware`
- Studio presets: `mastra dev --request-context-presets ./presets.json`

**FOSS candidates:** none (framework API); can be implemented with `AsyncLocalStorage`

---

### 5.4 Mastra Client SDK (`MastraClient`)

**Category:** server/client-sdk

**Purpose:** Type-safe client for calling agents, workflows, tools, memory, vectors from browser or server.

**Key params:**
- `new MastraClient({ baseUrl, retries?, backoffMs?, maxBackoffMs?, headers?, credentials?, abortSignal? })`
- `client.getAgent(id).generate(prompt, opts)` → `{ text }`
- `client.getAgent(id).stream(prompt, opts)` → `{ processDataStream({ onTextPart }) }`
- `client.getAgent(id).sendSignal(...)`, `subscribeToThread(...)`
- `client.pauseSchedule(scheduleId)`, `client.resumeSchedule(scheduleId)`
- `createTool(...)` — client-side tool definition; passed via `clientTools` to generate/stream
- Resource coverage: agents, memory (threads, messages), tools, workflows, vectors, logs, telemetry, responses (experimental), conversations (experimental)

**FOSS candidates:** `ofetch` (wrapper over fetch with retries); custom `AbortController` patterns

---

## 6. Memory

### 6.1 Message History

**Category:** memory/message-history

**Purpose:** Persist conversation messages (user, agent, tool) per resource+thread, enabling multi-turn context.

**Key API:**
- `new Memory({ options: { lastMessages: N } })` on Agent
- `agent.generate(prompt, { memory: { resource: 'user-id', thread: 'thread-id' } })`
- `memory.createThread({ threadId, resourceId, title, metadata })`, `memory.updateThread(...)`
- Thread metadata `workingMemory` key — inject initial working memory content

**Storage:** libSQL (default), PostgreSQL, Upstash, MongoDB, Cloudflare D1, DynamoDB

**FOSS candidates:** conversation storage: `better-sqlite3`, `pg`; in-memory for dev: `Map` + TTL

---

### 6.2 Working Memory

**Category:** memory/working-memory

**Purpose:** Persistent structured agent scratchpad (user profile, preferences, goals). Persists across threads (resource-scoped) or per-thread. Agent uses `updateWorkingMemory` tool to update it.

**Key params:**
- `workingMemory: { enabled: true, scope?: 'resource' | 'thread', template?: string, schema?: ZodSchema }`
- Template style: Markdown text block (replace semantics — full content on each update)
- Schema style: JSON object (merge semantics — only provide changed fields; `null` deletes a field; arrays replace entirely)
- `memory.updateWorkingMemory({ threadId, resourceId?, workingMemory })` — programmatic update
- Read-only mode: `memory: { ..., options: { readOnly: true } }` on generate/stream call

**FOSS candidates:** schema: `zod`; persistent KV: `keyv`, `level`

---

### 6.3 Observational Memory

**Category:** memory/observational

**Purpose:** Background agents compress old message history into dense observation logs, keeping context window small during long conversations.

**Key params:**
- `options: { observationalMemory: true }` on `Memory`

**FOSS candidates:** summarization without LLM: impossible; with local LLM: `ollama` / `llamacpp`

---

### 6.4 Semantic Recall

**Category:** memory/semantic-recall

**Purpose:** Retrieve relevant past messages by semantic similarity rather than recency.

**Key params:**
- `options: { semanticRecall: { topK?, scope?: 'resource' | 'thread' } }` on Memory
- Requires vector storage configured on Mastra instance

**FOSS candidates:** vector storage: `chromadb`, `qdrant`, `pgvector`; embeddings: `@xenova/transformers`, `fastembed`

---

### 6.5 Multi-User Threads

**Category:** memory/multi-user

**Purpose:** Share one thread between multiple users (e.g. group chats).

**FOSS candidates:** shared thread model: standard DB table with multiple `resourceId` entries per `threadId`

---

## 7. URL Inventory Bucket Analysis

Total URLs: 157

### Bucket classification (by URL path segments)

| Bucket | Count | Example URLs |
|--------|-------|--------------|
| **workflow** (core primitives webular builds with) | 11 | `/workflows/overview`, `/workflows/control-flow`, `/workflows/suspend-and-resume`, `/workflows/human-in-the-loop`, `/workflows/agents-and-tools`, `/workflows/workflow-state`, `/workflows/snapshots`, `/workflows/error-handling`, `/workflows/scheduled-workflows`, `/workflows/time-travel`, `/workflows` |
| **agent** (core agent API) | 13 | `/agents/overview`, `/agents/using-tools`, `/agents/structured-output`, `/agents/processors`, `/agents/agent-approval`, `/agents/background-tasks`, `/agents/networks`, `/agents/signals`, `/agents/response-caching`, `/agents/a2a`, `/agents/acp`, `/agents/adding-voice`, `/agents/channels`, `/agents/code-mode`, `/agents/guardrails`, `/agents/supervisor-agents` |
| **memory** | 8 | `/memory/overview`, `/memory/working-memory`, `/memory/memory-processors`, `/memory/message-history`, `/memory/multi-user-threads`, `/memory/observational-memory`, `/memory/semantic-recall`, `/memory/storage` |
| **streaming** | 5 | `/streaming/overview`, `/streaming/events`, `/streaming/tool-streaming`, `/streaming/workflow-streaming`, `/streaming/background-task-streaming` |
| **mcp** | 3 | `/mcp`, `/mcp/overview`, `/mcp/mcp-apps` |
| **server/http** | 12 | `/server/mastra-server`, `/server/mastra-client`, `/server/request-context`, `/server/custom-api-routes`, `/server/middleware`, `/server/auth`, `/server/auth/*` (auth0, better-auth, clerk, composite, custom, fga, firebase, jwt, okta, simple, supabase, workos), `/server/server-adapters`, `/server/custom-adapters` |
| **rag** (retrieval-augmented generation) | 5 | `/rag/overview`, `/rag/chunking-and-embedding`, `/rag/retrieval`, `/rag/graph-rag`, `/rag/vector-databases` |
| **observability/tracing** | 13 | `/observability/overview`, `/observability/logging`, `/observability/metrics/overview`, `/observability/tracing/overview`, `/observability/tracing/bridges/*`, `/observability/tracing/exporters/*`, `/observability/tracing/processors/*` |
| **evals** | 7 | `/evals/overview`, `/evals/built-in-scorers`, `/evals/custom-scorers`, `/evals/datasets/*`, `/evals/evals-with-memory`, `/evals/running-in-ci` |
| **deployment** | 5 | `/deployment/overview`, `/deployment/cloud-providers`, `/deployment/mastra-server`, `/deployment/monorepo`, `/deployment/web-framework`, `/deployment/workflow-runners` |
| **browser** | 4 | `/browser/overview`, `/browser/agent-browser`, `/browser/browser-viewer`, `/browser/stagehand` |
| **workspace** | 6 | `/workspace/overview`, `/workspace/filesystem`, `/workspace/lsp`, `/workspace/sandbox`, `/workspace/search`, `/workspace/skills` |
| **editor** | 3 | `/editor/overview`, `/editor/prompts`, `/editor/tools` |
| **studio** | 5 | `/studio/overview`, `/studio/auth`, `/studio/deployment`, `/studio/observability` |
| **voice** | 4 | `/voice/overview`, `/voice/speech-to-speech`, `/voice/speech-to-text`, `/voice/text-to-speech` |
| **agent-builder** | 10 | `/agent-builder/*` |
| **getting-started** | 3 | `/getting-started/build-with-ai`, `/getting-started/manual-install`, `/getting-started/project-structure` |
| **mastra-platform** | 5 | `/mastra-platform/*` |
| **tools** | 1 | `/tools` |
| **build-with-ai** | 2 | `/build-with-ai/mcp-docs-server`, `/build-with-ai/skills` |
| **community** | 3 | `/community/*` |
| **v0 (legacy)** | 4 | `/v0/memory/overview`, `/v0/observability/overview`, `/v0/server-db/storage`, `/v0/workflows/error-handling` |
| **cloud/gateway** | 2 | `cloud.mastra.ai/docs`, `gateway.mastra.ai/docs` |

---

## 8. Unique Capabilities Summary (webular build perspective)

1. **Typed multi-step pipeline engine** — `createStep` + `createWorkflow` with `.then()/.parallel()/.foreach()/.branch()/.map()` provides a deterministic, schema-validated DAG execution engine for web crawl → parse → extract → summarize pipelines without relying on LLM reasoning for control flow.

2. **Suspend / resume with durable snapshots** — workflows can pause at any step (e.g., waiting for rate limit cooldown, human approval of scrape targets, async callback from crawl job), persist full state to DB, and resume from exact pause point — even across server restarts.

3. **foreach + concurrency control** — `.foreach(step, { concurrency: N })` is the natural primitive for processing arrays of URLs in parallel with a configurable concurrency cap, matching common crawl/scrape batch patterns.

4. **Typed tool system** — `createTool` gives webular's scrape/parse/extract operations a schema-validated, agent-callable interface; tools can stream partial results via `context.writer`.

5. **Agent processors for pipeline hygiene** — `inputProcessors` and `outputProcessors` enable token limiting, tool-call filtering, PII redaction, moderation, and custom transformation of messages — useful when research agents are summarizing large scraped documents.

6. **Response caching** — `ResponseCache` processor avoids redundant LLM calls for repeated research queries, configurable with Redis (production) or in-memory (dev), tenant-scoped, with per-call cache-bust support.

7. **Background tasks** — Long-running scrape/crawl/research tool calls can be dispatched as background tasks; `streamUntilIdle()` keeps the agent stream open until all background tasks complete and the agent responds.

8. **Scheduled workflows** — Cron-based execution of monitoring, re-scrape, or report workflows declared inline with `schedule` on `createWorkflow`.

9. **Time travel debugging** — Re-execute any step of a pipeline with custom input, enabling incremental development and debugging of multi-step web research pipelines.

10. **MCP client** — `MCPClient.listTools()` provides drop-in access to hundreds of pre-built tools (Apify web scrapers, Composio SaaS integrations, Smithery AI tools) without building custom integrations.

11. **Working memory** — Persistent structured user/session state (resource-scoped or thread-scoped) means research agents remember context, preferences, and partial results across invocations.

12. **Streaming event system** — Agent and workflow stream events (`text-delta`, `tool-call`, `step-finish`, `foreach-progress`) enable real-time UI feedback during long crawl/research runs.

13. **HTTP server + custom routes** — Built-in Hono server exposes all workflows and agents as REST endpoints; `registerApiRoute` adds webhook receivers for crawl callbacks, schedule triggers, etc.

14. **Request context** — Dynamic agent configuration (instructions, model, memory) per HTTP request enables multi-tenant webular deployments where users have different scraping tiers or tool sets.

---

## 9. FOSS Library Reference by Capability

| Capability | FOSS Libraries (npm) |
|-----------|---------------------|
| Schema validation | `zod`, `valibot`, `arktype` |
| Cron scheduling | `node-cron`, `croner`, `cron-parser`, `@breejs/later` |
| Retry logic | `async-retry`, `p-retry` |
| Token counting | `tiktoken`, `gpt-tokenizer` |
| Response caching backend | `ioredis`, `lru-cache`, `keyv` |
| Task queuing | `bullmq`, `p-queue`, `workerpool` |
| Vector storage | `chromadb`, `qdrant` (Node client), `@electric-sql/pglite` (pgvector), `@xenova/transformers` |
| Text embeddings (local) | `@xenova/transformers`, `fastembed`, `ollama` |
| Storage backends | `better-sqlite3`, `pg`, `ioredis` |
| HTTP server | `hono`, `express`, `fastify` |
| SSE streaming | `eventsource-parser` |
| Web streams polyfill | `web-streams-polyfill` |
| OpenAPI generation | `zod-openapi`, `swagger-jsdoc` |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Durable execution | `inngest`, `temporal` (TypeScript SDK) |
| Async utilities | `p-limit`, `p-map`, `p-queue` |
