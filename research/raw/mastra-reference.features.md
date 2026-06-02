# Mastra Reference — Web Feature Catalog

**Source:** https://mastra.ai/reference  
**Total URLs inventoried:** 1135  
**Deep-read pages:** 30 (all 30 pre-selected API/reference pages)  
**Date analyzed:** 2026-06-02

---

## Overview

Mastra is a TypeScript AI-agent framework. From webular's perspective it provides:

1. **Workflow engine primitives** — deterministic, non-model control-flow that webular will use as its orchestration backbone (scrape/crawl/map/extract pipelines).
2. **Agent runtime primitives** — generate/stream wrappers webular uses for summarize/answer/research steps.
3. **Streaming primitives** — SSE/ReadableStream shapes webular uses to push progress to callers.

The sections below catalog every unique primitive with parameters, and map each to concrete FREE/OPEN-SOURCE alternatives (npm, pypi, cargo) that webular could fall back to or use directly without any paid API.

---

## Part 1 — Workflow Primitives (control-flow, non-model)

These are pure TypeScript orchestration primitives. No LLM is required to use them.

---

### 1.1 `createWorkflow(config)`

**Package:** `@mastra/core/workflows`  
**Purpose:** Define a typed state-machine workflow with input/output/state schemas and optional cron schedule. The central entry-point for all orchestration.

**Key params:**
- `id: string` — unique workflow identifier
- `inputSchema: StandardJSONSchemaV1` — validated with zod/valibot/arktype
- `outputSchema: StandardJSONSchemaV1`
- `stateSchema?: StandardJSONSchemaV1` — shared state across all steps
- `requestContextSchema?: StandardJSONSchemaV1` — per-request validation
- `schedule?: WorkflowScheduleConfig | WorkflowScheduleConfig[]` — cron expression + timezone + inputData
- `options.validateInputs?: boolean`
- `options.shouldPersistSnapshot?: (params) => boolean`
- `onFinish?: (result) => void`
- `onError?: (errorInfo) => void`

**Workflow statuses:** `success | failed | suspended | tripwire | canceled`

**FOSS alternatives:**
- [temporalio/sdk-typescript](https://github.com/temporalio/sdk-typescript) — full durable workflow engine (npm: `@temporaliolabs/worker`)
- [bullmq](https://www.npmjs.com/package/bullmq) — Redis-backed job queue with workflows
- [xstate](https://www.npmjs.com/package/xstate) — state-machine library for TypeScript/JavaScript
- [node-red](https://nodered.org/) — flow-based visual workflow engine

---

### 1.2 `createStep(config)` / `Step` class

**Package:** `@mastra/core/workflows`  
**Purpose:** Define a single unit of work with typed input/output/resume/suspend schemas and an `execute` function. Steps can also be created directly from an `Agent` instance.

**Key execute params (ExecuteParams):**
- `inputData: z.infer<TStepInput>` — step input
- `resumeData?: z.infer<TResumeSchema>` — data injected on resume
- `suspendData?: z.infer<TSuspendSchema>` — data that was provided when suspended
- `mastra: Mastra` — access to agents, tools, workflows
- `getStepResult(step | string): any` — read outputs of earlier steps
- `getInitData(): any` — read workflow initial input
- `suspend(payload, options?) => Promise<void>` — pause execution
- `state: z.infer<TState>` — shared workflow state
- `setState(state): void` — update shared state
- `runId: string`
- `requestContext?: RequestContext`
- `retryCount?: number`
- `abortSignal: AbortSignal` — Web API signal; check `.aborted` or listen to `abort` event
- `abort(): void` — trigger self-abort from inside step

**Creating step from agent:**
```ts
const agentStep = createStep(myAgent, { structuredOutput: { schema: articleSchema } })
```

**FOSS alternatives:**
- Plain `async` functions in xstate/bullmq jobs
- [inngest/inngest-js](https://www.npmjs.com/package/inngest) — step-based durable functions (free self-hosted)
- [trigger.dev/sdk](https://www.npmjs.com/package/@trigger.dev/sdk) — step orchestration

---

### 1.3 `Workflow.then(step)`

**Purpose:** Sequential step execution — step A completes before step B starts.  
**Returns:** Workflow (chainable)

**FOSS alternative:** Plain `await` chain or xstate `invoke` actions in sequence.

---

### 1.4 `Workflow.parallel(steps[])`

**Purpose:** Execute multiple steps concurrently. All steps receive the same input; the next `.then()` step receives all their outputs combined.  
**Params:** `steps: Step[]`

**FOSS alternatives:**
- `Promise.all([...])` for ad-hoc parallelism
- bullmq `FlowProducer` for parallel job groups

---

### 1.5 `Workflow.branch(tuples[])`

**Purpose:** Conditional branching — evaluate boolean predicate functions and route to matching step.  
**Params:** `steps: [(context) => boolean, Step][]`

**FOSS alternatives:**
- xstate `guards` / `transitions`
- Plain `if/else` inside a step execute function

---

### 1.6 `Workflow.foreach(step, opts?)`

**Purpose:** Map-style loop — execute a step for every item in an array, returning an ordered results array.  
**Params:**
- `step: Step` — receives one array element per invocation
- `opts.concurrency?: number` — parallel batch size (default: 1)

**Streaming progress events (when using `run.stream()`):**
- `workflow-step-progress` → `{ id, completedCount, totalCount, currentIndex, iterationStatus, iterationOutput? }`

**Resume support:** individual iterations can be resumed with `forEachIndex`.

**FOSS alternatives:**
- `Promise.all(items.map(item => step(item)))` or `p-map` (npm: `p-map`) for concurrency control
- bullmq `Flow` with children per item

---

### 1.7 `Workflow.dowhile(step, condition)`

**Purpose:** Post-condition loop — run step at least once, repeat while condition is truthy.  
**Params:**
- `step: Step`
- `condition: (params & { iterationCount: number }) => Promise<boolean>`

**FOSS alternatives:**
- Plain `do { ... } while(condition)` async loop
- xstate guarded self-transitions

---

### 1.8 `Workflow.dountil(step, condition)`

**Purpose:** Post-condition loop — run step at least once, stop when condition is truthy (inverse of dowhile).  
**Params:**
- `step: Step`
- `condition: (params & { iterationCount: number }) => Promise<boolean>`

**FOSS alternatives:**
- Same as dowhile with negated condition
- xstate guarded self-transitions

---

### 1.9 `Workflow.map(mappingFn | objectDef)`

**Purpose:** Transform data between steps without side effects. Can be a function (`({ inputData }) => any`) or a declarative object using `mapVariable()`.

**`mapVariable({ step, path })`** — extract a field from a prior step's output.  
**`mapVariable({ initData: workflow, path })`** — extract from the workflow's initial input.

Utility functions available in step context:
- `inputData` — output of the immediately preceding step/foreach
- `getStepResult(step)` — output of any named step
- `getInitData()` — original workflow input

**FOSS alternatives:**
- Plain `map` function in step execute
- lodash `_.pick` / `_.get`

---

### 1.10 `Workflow.sleep(ms | callback)`

**Purpose:** Pause workflow execution for N milliseconds. Accepts static number or async callback returning a number.  
**Params:** `milliseconds: number | ((context) => number | Promise<number>)`

**FOSS alternatives:**
- `await new Promise(r => setTimeout(r, ms))`
- inngest/temporal built-in sleep primitives (durable)

---

### 1.11 `Workflow.sleepUntil(date | callback)`

**Purpose:** Pause execution until a specific timestamp.  
**Params:** `dateOrCallback: Date | (params) => Promise<Date>`

**FOSS alternatives:**
- `await new Promise(r => setTimeout(r, target - Date.now()))`
- Temporal durable timer (`workflow.sleep(duration)`)
- node-cron / agenda for absolute time scheduling

---

### 1.12 `Workflow.commit()`

**Purpose:** Finalize the workflow definition and lock the step chain. Must be called after all `.then()/.foreach()/.branch()` etc.  
**Returns:** Workflow (frozen definition)

---

### 1.13 `Workflow.createRun(opts?)`

**Purpose:** Instantiate a new `Run` execution object from a committed workflow definition.  
**Params:**
- `runId?: string` — custom run identifier (auto-generated if omitted)
- `resourceId?: string` — associate run with a user/tenant; persisted and queryable
- `disableScorers?: boolean`

**Returns:** `Run` instance

**FOSS alternatives:**
- bullmq `Queue.add(name, data, opts)` 
- Temporal `client.workflow.start()`

---

## Part 2 — Run Methods (workflow execution control)

---

### 2.1 `Run.start(opts?)`

**Purpose:** Start workflow execution synchronously (awaits completion).  
**Params:**
- `inputData?: z.infer<TInput>` — must match workflow `inputSchema`
- `requestContext?: RequestContext`
- `outputWriter?: (chunk: TOutput) => Promise<void>` — streaming output handler
- `tracingContext?, tracingOptions?, metadata?, traceId?, parentSpanId?, tags?` — observability
- `outputOptions?, includeState?: boolean`

**Returns:** `Promise<WorkflowResult<TState, TOutput, TSteps>>` — contains `status`, `result`, `error`, `steps`, `traceId?`, `spanId?`

---

### 2.2 `Run.startAsync(opts?)`

**Purpose:** Fire-and-forget workflow start. Returns `runId` immediately without waiting for completion.  
**Params:**
- `inputData?, requestContext?, initialState?, tracingOptions?, metadata?, traceId?, outputOptions?, includeState?`

**Returns:** `{ runId: string }`  
**Status check:** `workflow.getWorkflowRunExecutionResult(runId)` → `{ status: 'running' | 'success' | 'failed', steps }`

**Use when:** Long-running pipelines, cron triggers, Inngest-style background jobs.

---

### 2.3 `Run.resume(opts?)`

**Purpose:** Resume a suspended workflow from a named step, injecting new data.  
**Params:**
- `resumeData?: z.infer<TResumeSchema>` — data the suspended step was waiting for
- `step?: Step | Step[] | string | string[]` — which step(s) to resume (auto-detected when only one suspended)
- `forEachIndex?: number` — target one specific foreach iteration (0-based)
- `requestContext?, tracingContext?, metadata?, traceId?, parentSpanId?, tags?, outputOptions?, includeState?`

**Returns:** `Promise<WorkflowResult>`

**Human-in-the-loop pattern:** Workflow suspends at an "approval" step; external actor calls `run.resume({ resumeData: { ok: true } })`.

---

### 2.4 `Run.restart(opts?)`

**Purpose:** Reconnect to an active workflow run that lost server connection. Resumes from the last active step without re-running completed steps.  
**Params:** `requestContext?, tracingContext?, metadata?, traceId?, parentSpanId?, tags?`  
**Returns:** `Promise<WorkflowResult>`

---

### 2.5 `Run.timeTravel(opts)`

**Purpose:** Re-execute a workflow starting from any specific step. Uses persisted snapshot data or custom context. Ideal for debugging, retry-from-step, or replaying with different inputs.  
**Params:**
- `step: Step | Step[] | string | string[]` — target step (supports dot notation for nested: `'nestedWorkflow.step3'`)
- `inputData?: z.infer<TInputSchema>` — custom input for target step
- `resumeData?: any`
- `initialState?: z.infer<TState>`
- `context?: TimeTravelContext` — mock results for steps prior to target
- `nestedStepsContext?: Record<string, TimeTravelContext>` — context for nested workflow steps
- `requestContext?, outputWriter?, tracingContext?, metadata?, outputOptions?, includeState?, includeResumeLabels?`

**Returns:** `Promise<WorkflowResult>`  
**Requires:** Storage configured (relies on persisted snapshots).

---

### 2.6 `Run.cancel()`

**Purpose:** Abort workflow execution, stopping running steps and preventing subsequent ones. Uses Web API `AbortSignal`.  
**Params:** None  
**Returns:** `Promise<{ message: 'Workflow run canceled' }>`

**AbortSignal integration in steps:**
```ts
execute: async ({ abortSignal, abort }) => {
  abortSignal.addEventListener('abort', () => clearTimeout(timer))
  if (abortSignal.aborted) return abort()
}
```

---

## Part 3 — Streaming (workflows)

---

### 3.1 `Run.stream(opts?)`

**Purpose:** Start workflow and return a `WorkflowRunOutput` with a live event stream.  
**Params:** Same as `Run.start()` plus `closeOnSuspend?: boolean` (default `true`).  
**Returns:** `WorkflowRunOutput` — async iterable + `{ fullStream, result, status, usage }`

**Stream event types:**
- `workflow-start`
- `workflow-step-start`
- `workflow-step-output` (custom step output)
- `workflow-step-progress` (foreach per-iteration: `{ completedCount, totalCount, currentIndex, iterationStatus, iterationOutput? }`)
- `workflow-step-result`
- `workflow-finish` (includes token usage)

**FOSS alternatives:**
- Node.js `ReadableStream` / `EventEmitter`
- [rxjs](https://www.npmjs.com/package/rxjs) Observables for event streams
- [eventsource-parser](https://www.npmjs.com/package/eventsource-parser) for SSE

---

### 3.2 `Run.resumeStream(opts?)`

**Purpose:** Resume a suspended workflow while also returning a live event stream.  
**Params:**
- `resumeData?, requestContext?, step?, forEachIndex?, tracingOptions?, metadata?, traceId?, parentSpanId?, tags?`

**Returns:** `MastraWorkflowStream<ChunkType>` — extends `ReadableStream` with `{ status, result, usage }` properties.

---

### 3.3 `Run.observeStream()`

**Purpose:** Re-attach a new ReadableStream to an already-running workflow (useful when the original stream was lost / the page reloaded).  
**Returns:** `ReadableStream<ChunkType>` — same event types as `Run.stream()`

---

### 3.4 `Run.timeTravelStream(opts)`

**Purpose:** Time travel + live event stream. Same params as `Run.timeTravel()`.  
**Returns:** `WorkflowRunOutput` with `{ fullStream, result, traceId? }`  
**Stream events:** `workflow-step-start`, `workflow-step-finish`, `workflow-step-error`, `workflow-step-suspended`

---

## Part 4 — Workflow State & Inspection

---

### 4.1 `createWorkflowStateReader(state)`

**Package:** `@mastra/core/workflows`  
**Purpose:** Inspect persisted `WorkflowState` objects returned by `workflow.getWorkflowRunById()`.

**Standalone functions:**
- `getWorkflowStepOutput(state, stepId)` — output for a step ID (supports dot paths, foreach returns array)
- `getWorkflowStepPayload(state, stepId)` — input payload for a step
- `getWorkflowSuspendedStep(state)` — first suspended step
- `getWorkflowSuspendedSteps(state)` — all suspended steps (with `path`, `executionPath`, `resumeLabels`)
- `getWorkflowResumeLabel(state, label)` — lookup a resume label
- `getWorkflowResumeLabels(state)` — all resume labels

**Reader methods (bound to one `WorkflowState`):**
- `getStatus() => WorkflowRunStatus`
- `getResult() => WorkflowState["result"]`
- `getError() => WorkflowState["error"]`
- `getStepOutput(stepId) => any`
- `getStepPayload(stepId) => any`
- `getSuspendedStep() => { stepId, path, resumeLabels, ... }`
- `getSuspendedSteps() => Array<...>`
- `getResumeLabel(label) => { stepId, foreachIndex? }`
- `getResumeLabels() => Record<string, ...>`

**FOSS alternatives:**
- Custom reducer over a plain JSON snapshot object

---

## Part 5 — Agent Primitives

---

### 5.1 `Agent` class constructor

**Package:** `@mastra/core/agent`  
**Purpose:** Create a named AI agent with a model, instructions, tools, memory, and processors.

**Key constructor params:**
- `id?: string`, `name: string`, `description?: string`
- `instructions: SystemMessage | ({ requestContext }) => SystemMessage` — string, array, CoreSystemMessage, or function
- `model: MastraLanguageModel | ({ requestContext }) => MastraLanguageModel`
- `tools?: ToolsInput | ({ requestContext }) => ToolsInput`
- `agents?: Record<string, Agent>` — sub-agents for supervisor pattern
- `workflows?: Record<string, Workflow>` — workflows agent can trigger
- `memory?: MastraMemory`
- `voice?: CompositeVoice`
- `inputProcessors?: (Processor | ProcessorWorkflow)[]`
- `outputProcessors?: (Processor | ProcessorWorkflow)[]`
- `maxProcessorRetries?: number`
- `scorers?: MastraScorers`
- `defaultOptions?: AgentExecutionOptions`
- `requestContextSchema?: StandardJSONSchemaV1`
- `transform?: ToolPayloadTransformPolicy`
- `metadata?: Record<string, unknown> | ({ requestContext }) => Record<string, unknown>`

---

### 5.2 `Agent.generate(messages, opts?)`

**Purpose:** Non-streaming LLM generation. Returns all text, tool calls, structured output, usage in one awaited result.

**Key options (AgentExecutionOptions):**
- `maxSteps?: number` — max LLM round-trips (default 5)
- `stopWhen?: LoopOptions['stopWhen']`
- `onIterationComplete?: (ctx) => { continue?, feedback? }` — per-step callback with early-stop
- `isTaskComplete?: { scorers, strategy?, onComplete?, parallel?, timeout? }` — auto-check task completion
- `delegation?: { onDelegationStart?, onDelegationComplete?, messageFilter? }` — sub-agent control
- `structuredOutput?: { schema, model?, errorStrategy?, fallbackValue?, jsonPromptInjection? }`
- `memory?: { thread, resource, options? }`
- `modelSettings?: { temperature?, maxOutputTokens?, topP?, topK?, presencePenalty?, frequencyPenalty?, stopSequences?, toolChoice?, maxRetries? }`
- `abortSignal?: AbortSignal`
- `requireToolApproval?: boolean`
- `autoResumeSuspendedTools?: boolean`
- `toolCallConcurrency?: number`
- `activeTools?: Array<keyof ToolSet>`
- `prepareStep?: PrepareStepFunction`
- `scorers?, returnScorerData?, onChunk?, onError?, onAbort?, onFinish?, onStepFinish?`
- `telemetry?, providerOptions?, runId?, requestContext?, tracingContext?`
- `versions?: VersionOverrides` — per-invocation sub-agent version overrides
- `includeRawChunks?: boolean`

**Response shape:**
- `text: string`
- `object?: OUTPUT` (structured output)
- `toolCalls: ToolCallChunk[]` — each with `{ type, runId, from, payload: { toolCallId, toolName, args } }`
- `toolResults: ToolResultChunk[]` — each with `{ payload: { toolCallId, toolName, result, isError? } }`
- `usage: TokenUsage`
- `steps: { text, toolCalls, toolResults, finishReason, usage, request, response }[]`
- `finishReason: 'stop' | 'tool-calls' | 'suspended' | 'error'`
- `response: { id?, timestamp?, modelId?, headers?, messages?, uiMessages? }`
- `messages: MastraDBMessage[]`
- `suspendPayload?: { toolCallId, toolName, args, runId? }` — present when `finishReason === 'suspended'`
- `reasoning?: ReasoningChunk[]`
- `sources?: SourceChunk[]`
- `files?: FileChunk[]`
- `traceId?, spanId?`

---

### 5.3 `Agent.generateLegacy(messages, opts?)` — DEPRECATED

**Note:** Only for V1 models. Use `.generate()` for V2+.  
**Differences from `.generate()`:** `maxTokens` (not `maxOutputTokens`), `temperature` at top level (not in `modelSettings`), `experimental_output` for structured output.

---

### 5.4 `Agent.network(messages, opts?)` — DEPRECATED

**Note:** Deprecated in favor of supervisor agents. Routes between sub-agents and workflows.  
**Returns:** `MastraAgentNetworkStream` with `{ status, result, usage, object, objectStream }`.  
**AbortSignal** stops routing and in-progress sub-agents without saving partial memory.

---

### 5.5 Thread Signals API

**`agent.sendMessage(message, options)`** — Send user-authored input to an active run or idle thread.
- `options.runId?, resourceId?, threadId?`
- `options.ifActive.behavior?: 'deliver' | 'persist' | 'discard'`
- `options.ifIdle.behavior?: 'wake' | 'persist' | 'discard'`
- `options.ifIdle.streamOptions?: AgentExecutionOptions`
- Returns: `{ accepted: true, runId, signal, persisted? }`

**`agent.queueMessage(message, options)`** — Queue for next turn (waits if active, starts immediately if idle). Same signature as `sendMessage`.

**`agent.sendSignal(signal, options)`** — Lower-level API for system-generated context.
- `signal.type: 'user' | 'state' | 'reactive' | 'notification' | 'user-message' | 'system-reminder'`
- `signal.tagName?: string` — renders as `<tagName>content</tagName>` in prompt
- `signal.contents: string | Array<TextPart | FilePart>`
- `signal.attributes?: Record<string, JSONValue>` — renders as XML attributes
- Same `options` as `sendMessage`

**`agent.subscribeToThread(options)`** — Subscribe to raw stream chunks for a thread before calling send/queue/sendSignal.
- `options.threadId: string`, `options.resourceId?: string`
- Returns `AgentThreadSubscription`:
  - `.stream: AsyncIterable<AgentChunkType>` — raw chunks
  - `.activeRunId(): string | null`
  - `.abort(): boolean`
  - `.unsubscribe(): void`

---

## Part 6 — Agent Streaming (MastraModelOutput)

---

### 6.1 `Agent.stream(messages, opts?)` → `MastraModelOutput`

**Purpose:** Streaming LLM invocation. Returns `MastraModelOutput` with both live stream properties and promise-based final accessors. Same options as `Agent.generate()`.

**MastraModelOutput streaming properties:**
- `.fullStream: ReadableStream<ChunkType>` — all chunk types: text-delta, tool-call, tool-result, reasoning-delta, finish, error, etc.
- `.textStream: ReadableStream<string>` — incremental text only
- `.objectStream: ReadableStream<Partial<OUTPUT>>` — progressive structured object (when schema given)
- `.elementStream: ReadableStream<T>` — individual array elements (when output schema is an array)

**MastraModelOutput promise properties:**
- `.text: Promise<string>` — complete response
- `.object: Promise<OUTPUT>` — complete validated structured object
- `.reasoning: Promise<string>` — reasoning text (empty string for non-reasoning models)
- `.reasoningText: Promise<string | undefined>`
- `.toolCalls: Promise<ToolCallChunk[]>`
- `.toolResults: Promise<ToolResultChunk[]>`
- `.usage: Promise<LanguageModelUsage>` — `{ inputTokens, outputTokens, totalTokens, reasoningTokens?, cachedInputTokens? }`
- `.finishReason: Promise<string | undefined>`
- `.response: Promise<Response>` — `{ id?, timestamp?, modelId?, headers?, messages?, uiMessages? }`
- `.error: string | Error | { message, stack } | undefined`

**MastraModelOutput methods:**
- `.getFullOutput(): Promise<FullOutput>` — all of the above in one object
- `.consumeStream(opts?): Promise<void>` — drain stream without processing (triggers promise resolution)

**ChunkType values in fullStream:**
- `text-delta` — `{ payload: { text: string } }`
- `tool-call` — `{ payload: { toolCallId, toolName, args } }`
- `tool-result` — `{ payload: { toolCallId, toolName, result, isError? } }`
- `reasoning-delta` — `{ payload: { text } }`
- `finish` — `{ payload: { stepResult: { reason }, response?: { uiMessages } } }`

---

## Part 7 — URL Inventory by Capability Bucket

Total URLs: 1135. Categorization by URL path and title:

### 7.1 Workflow Orchestration (build-with primitives)
URLs: ~35 (`/reference/workflows/**`, `/docs/workflows/**`)
- run-methods: start, startAsync, resume, restart, cancel, timeTravel
- workflow-methods: createRun, then, parallel, branch, foreach, map, dowhile, dountil, sleep, sleepUntil, commit
- core classes: Workflow, Step, Run
- state readers: workflow-state-reader
- docs: control-flow, suspend-and-resume, time-travel, snapshots, error-handling, scheduled-workflows

### 7.2 Agent Runtime (build-with primitives)
URLs: ~30 (`/reference/agents/**`, `/docs/agents/**`)
- Agent class, generate, generateLegacy, network, stream, channels, signals
- getMemory, getLLM, getTools, listTools, listAgents, listWorkflows, listScorers
- Supervisor agents, multi-agent networks, background tasks, agent approval, guardrails

### 7.3 Streaming (build-with primitives)
URLs: ~15 (`/reference/streaming/**`, `/docs/streaming/**`)
- workflow: stream, resumeStream, observeStream, timeTravelStream
- agents: stream, streamLegacy, streamUntilIdle, MastraModelOutput
- ChunkType reference
- docs: workflow-streaming, background-task-streaming, tool-streaming

### 7.4 RAG / Retrieval (build-with primitives)
URLs: ~20 (`/reference/rag/**`, `/docs/rag/**`)
- document, chunk, embeddings, metadata-filters, rerank, rerankWithScorer, extract-params
- graph-rag, database-config
- docs: chunking-and-embedding, retrieval, vector-databases, graph-rag

### 7.5 Vector Storage (backing store)
URLs: ~25 (`/reference/vectors/**`)
- pg, pinecone, qdrant, upstash, mongodb, elasticsearch, opensearch, chroma, astra, libsql, duckdb, vectorize, convex, turbopuffer, lance, couchbase, s3vectors

### 7.6 Memory (build-with primitives)
URLs: ~20 (`/reference/memory/**`, `/docs/memory/**`)
- memory-class, createThread, getThreadById, listThreads, cloneThread, deleteMessages, recall
- observational-memory, serialized-memory-config, clone-utilities

### 7.7 Tool Creation (build-with primitives)
URLs: ~10 (`/reference/tools/**`)
- create-tool, document-chunker-tool, graph-rag-tool, vector-query-tool, mcp-client, mcp-server

### 7.8 Observability / Tracing (build-with)
URLs: ~25 (`/reference/observability/**`, `/docs/observability/**`)
- tracing: configuration, instances, spans, interfaces, span-filtering
- exporters: otel, langfuse, langsmith, braintrust, datadog, sentry, arize, laminar, posthog, default, console, arthur, mastra-platform, mastra-storage
- bridges: otel, datadog
- processors: sensitive-data-filter
- metrics: automatic-metrics

### 7.9 Storage Backends
URLs: ~20 (`/reference/storage/**`)
- postgresql, libsql, mongodb, upstash, cloudflare, cloudflare-d1, dynamodb, convex, redis, clickhouse, spanner, mssql, composite, dsql, duckdb, lance

### 7.10 Server / Deployment (build-with primitives)
URLs: ~20 (`/reference/server/**`, `/docs/deployment/**`, `/docs/server/**`)
- adapters: hono, express, fastify, koa, nestjs
- routes: create-route, register-api-route, mastra-server, server-routes
- auth: jwt, better-auth, clerk, okta, workos, supabase, auth0, firebase, custom-auth-provider, composite-auth, fga
- deployers: cloudflare, netlify, vercel
- docs: server-adapters, custom-adapters, middleware, request-context, mastra-client

### 7.11 Processors / Guardrails (build-with primitives)
URLs: ~20 (`/reference/processors/**`)
- moderation-processor, pii-detector, prompt-injection-detector, token-limiter-processor
- language-detector, unicode-normalizer, tool-call-filter, tool-search-processor
- semantic-recall-processor, batch-parts-processor, message-history-processor, system-prompt-scrubber
- working-memory-processor, cost-guard-processor, response-cache, regex-filter-processor
- skill-search-processor, prefill-error-handler, provider-history-compat, stream-error-retry-processor

### 7.12 Voice / Speech
URLs: ~20 (`/reference/voice/**`)
- openai, openai-realtime, google, google-gemini-live, deepgram, elevenlabs, azure, playai, murf, sarvam, speechify, cloudflare, composite-voice, mastra-voice, aws-nova-sonic, inworld, xai-realtime
- voice API: connect, listen, speak, send, close, on, off, addInstructions, addTools, getSpeakers, updateConfig, events, answer

### 7.13 Evals / Scoring (build-with primitives)
URLs: ~25 (`/reference/evals/**`, `/docs/evals/**`)
- scorers: answer-relevancy, answer-similarity, bias, completeness, content-similarity, context-precision, context-relevance, faithfulness, hallucination, keyword-coverage, noise-sensitivity, prompt-alignment, textual-difference, tone-consistency, tool-call-accuracy, toxicity, trajectory-accuracy
- utilities: create-scorer, mastra-scorer, run-evals, filter-run, scorer-utils
- datasets: dataset, create, get, update, delete, list, listItems, addItem, addItems, deleteItem, startExperiment, startExperimentAsync, compareExperiments

### 7.14 Workspace / Sandbox (build-with for code-execution steps)
URLs: ~20 (`/reference/workspace/**`)
- filesystems: local-filesystem, local-sandbox, s3-filesystem, gcs-filesystem, agentfs-filesystem, azure-blob-filesystem, google-drive-filesystem, files-sdk-filesystem
- sandboxes: e2b-sandbox, blaxel-sandbox, daytona-sandbox, docker-sandbox, modal-sandbox, agentcore-runtime-sandbox, vercel-microvm-sandbox
- workspace-class, process-manager, filesystem, sandbox (docs)

### 7.15 Browser Automation (build-with for web scraping)
URLs: ~8 (`/reference/browser/**`, `/docs/browser/**`)
- mastra-browser, agent-browser, browser-viewer, stagehand-browser
- docs: overview, agent-browser, browser-viewer, stagehand integration

### 7.16 AI SDK Adapters
URLs: ~10 (`/reference/ai-sdk/**`)
- with-mastra, chat-route, workflow-route, network-route, handle-chat-stream, handle-workflow-stream, handle-network-stream, to-ai-sdk-stream, to-ai-sdk-messages, to-ai-sdk-v4-messages, to-ai-sdk-v5-messages

### 7.17 Client SDK
URLs: ~15 (`/reference/client-js/**`)
- mastra-client, agents, workflows, memory, vectors, tools, logs, telemetry, observability, error-handling, agent-builder, conversations, responses

### 7.18 Model Providers (non-primitives — hosted LLMs)
URLs: ~150 (`/models/providers/**`, `/models/gateways/**`)
- All major LLM providers: openai, anthropic, google, azure, cohere, mistral, groq, deepseek, llama, huggingface, ollama, xai, etc.
- Gateways: mastra, openrouter, vercel, netlify, azure-openai, custom-gateways
- Embeddings directory

### 7.19 MCP (Model Context Protocol)
URLs: ~8 (`/reference/tools/mcp-*`, `/docs/mcp/**`)
- mcp-client, mcp-server tools; docs: overview, mcp-apps, mcp-docs-server

### 7.20 Auth (non-web-feature)
URLs: ~15 (`/reference/auth/**`)
- jwt, clerk, workos, better-auth, supabase, auth0, firebase, okta

### 7.21 Logging
URLs: ~3 (`/reference/logging/**`)
- pino-logger

### 7.22 Harness
URLs: ~2 (`/reference/harness/**`)
- harness-class

### 7.23 Core / Mastra class
URLs: ~25 (`/reference/core/**`)
- mastra-class, mastra-model-gateway
- getAgent, getAgentById, getWorkflow, getMemory, getScorer, getVector, getStorage, getLogger, getTelemetry, getServer, getDeployer, getEditor, getMCPServer, getMCPServerById
- listAgents, listWorkflows, listMemory, listScorers, listVectors, listGateways, listMCPServers, listLogs, listLogsByRunId
- addGateway, getGateway, getGatewayById, setLogger, setStorage

### 7.24 Templates / Guides / Blogs (non-reference)
URLs: ~400 (`/templates/**`, `/guides/**`, `/blog/**`, `/learn/**`, `/workshops/**`, `/podcasts/**`)
- Not API references; categorized as informational/other

### 7.25 Other / Meta
- `/sitemap.xml`, `/sitemaps/`, `/about`, `/contact`, `/careers`, `/pricing`, `/privacy-policy`, `/terms-of-service`, `/customers/**`, `/hackathon`, `/newsletter`, `/mcp-registry`, `/course`, `/books/**`, `/resources`, `/research`
- External: `code.mastra.ai`, `cloud.mastra.ai`, `gateway.mastra.ai`, `trust.mastra.ai`

---

## Part 8 — Unique Capabilities / Design Patterns webular should adopt

1. **Time Travel Debugging** — Re-run a pipeline from any step with custom context. Invaluable for: "retry a failed scrape step with different params without re-running all prior fetch steps".

2. **Durable Suspend/Resume with labels** — A workflow step can `suspend({ prompt: 'Approval needed' })` and a human-in-the-loop caller calls `run.resume({ resumeData: { ok: true } })` later. For webular: "pause and ask user to confirm a crawl scope before proceeding."

3. **Per-step AbortSignal** — Each step receives a Web API `AbortSignal`. Useful for canceling in-flight HTTP/browser sessions when a pipeline is cancelled.

4. **Typed state across steps** — `stateSchema` shared across all steps via `state`/`setState`, persisted through suspend/resume cycles. For webular: tracking `pagesVisited`, `rateLimitHits`, `totalBytes` across a crawl.

5. **foreach with concurrency + per-iteration resume** — Process URL arrays with configurable parallelism; individual items can be suspended/resumed independently.

6. **startAsync + polling pattern** — Background pipeline with fire-and-forget; client polls via `getWorkflowRunExecutionResult(runId)`. For webular: long crawl jobs the CLI can hand off.

7. **Thread signals (sendMessage / sendSignal)** — Push context into a running agent loop mid-stream. For webular: inject "user added new URL" while an agent is researching.

8. **outputWriter** — Stream per-step outputs incrementally (not waiting for full completion). For webular: stream extracted text chunks to stdout as they arrive from pages.

9. **Tripwire status** — Processor can halt agent/workflow with a `tripwire` result (not an error). For webular: content moderation on scraped pages stopping the pipeline cleanly.

10. **`mapVariable()` declarative mapping** — Extract named fields from prior step outputs or initial workflow input without writing mapping functions. Useful for composing scrape → parse → embed pipelines.

---

## Part 9 — FOSS Library Mapping (full cross-reference)

For each webular feature category, the best free/open-source libraries that do NOT require a paid API:

### Scraping / HTML fetch
- **playwright** (npm: `playwright`) — full browser automation, JS rendering, screenshots, PDF
- **puppeteer** (npm: `puppeteer`) — Chrome DevTools Protocol, headless browser
- **cheerio** (npm: `cheerio`) — fast jQuery-like HTML parsing, no browser needed
- **turndown** (npm: `turndown`) — HTML → Markdown conversion
- **@mozilla/readability** (npm: `@mozilla/readability`) — main-content extraction (Readability.js)
- **node-fetch** / **undici** (npm: `undici`) — HTTP/2 fetch for Node.js
- **got** (npm: `got`) — HTTP client with retries/proxies/streams

### Crawling / BFS web crawling
- **crawlee** (npm: `crawlee`) — production-grade web scraper with Playwright/Cheerio, BFS queue, storage adapters
- **Apify SDK** (npm: `apify`) — open-source crawler SDK (works with self-hosted Apify platform)
- **playwright-scraper** — custom BFS using Playwright + Set() for visited
- Custom `async-queue` + `p-limit` + `fetch` pattern

### Sitemap / URL discovery
- **sitemapper** (npm: `sitemapper`) — parse sitemap.xml trees
- **xml2js** (npm: `xml2js`) — parse XML sitemaps manually
- **crawler** (npm: `crawler`) — link extraction with HTTP queue

### Search (no paid API)
- **searxng** — self-hosted meta-search engine (Docker image)
- **duckduckgo-search** (npm: `duck-duck-scrape`) — unofficial DDG API wrapper (free, rate-limited)
- **brave-search** — free tier (2000 req/mo), npm: custom fetch to `api.search.brave.com`
- **SearXNG API** — self-hosted REST API for federated search
- **Bing Autosuggest** free tier

### Content extraction / parsing
- **unstructured** (pypi: `unstructured`) — multi-format document parsing (PDF, Word, HTML, etc.)
- **pdf-parse** (npm: `pdf-parse`) — PDF text extraction
- **pdf.js** (npm: `pdfjs-dist`) — Mozilla PDF renderer, works in Node
- **mammoth** (npm: `mammoth`) — Word docx → HTML/Markdown
- **xlsx** (npm: `xlsx`) — Excel spreadsheet parsing
- **csv-parse** (npm: `csv-parse`) — CSV parsing streams
- **sharp** (npm: `sharp`) — image processing / thumbnail generation

### Readability / main-content
- **@mozilla/readability** (npm) — Mozilla's extraction algorithm (used in Firefox)
- **node-unfluff** (npm: `unfluff`) — content extraction with language detection
- **mercury-parser** (npm: `@postlight/mercury-parser`) — article extraction

### HTML → Markdown
- **turndown** (npm: `turndown`) + **turndown-plugin-gfm** — configurable HTML→MD
- **htmlparser2** (npm: `htmlparser2`) — SAX-style HTML parser

### Screenshot
- **playwright** — `page.screenshot({ fullPage: true })`
- **puppeteer** — `page.screenshot()`

### PDF generation
- **puppeteer** — `page.pdf()`
- **playwright** — `page.pdf()`

### Summarization / answer synthesis (FOSS LLM)
- **ollama** (local: `ollama run llama3`) — local LLM serving
- **llamafile** — single-binary LLM runner
- **transformers.js** (npm: `@xenova/transformers`) — WASM transformers for Node

### Embeddings (FOSS)
- **@xenova/transformers** — ONNX sentence transformers (all-MiniLM, etc.)
- **fastembed** (npm: `fastembed`) — fast local embeddings
- **ollama** — `nomic-embed-text` or `mxbai-embed-large`

### Vector search (FOSS, no API)
- **hnswlib-node** (npm: `hnswlib-node`) — in-process HNSW
- **@lancedb/lancedb** (npm) — local columnar vector store
- **chromadb** (npm: `chromadb`) — self-hosted vector DB
- **qdrant** — Docker self-hosted vector DB

### Monitoring / change detection
- **rss-parser** (npm: `rss-parser`) — RSS/Atom feed polling
- Custom fetch + hash comparison for page change detection
- **Playwright** with periodic screenshots + pixelmatch diffing

### Workflow orchestration (FOSS alternatives to Mastra)
- **temporallio/sdk-typescript** — full durable workflows
- **bullmq** — Redis-backed job queues with priorities, delays, retries
- **inngest** (self-hosted) — step-based serverless functions
- **xstate** — state machines (no persistence out of the box)
- **p-queue** (npm: `p-queue`) — lightweight async queue with concurrency

### HTTP proxy / stealth
- **undici** with proxy agent — `npm: undici`
- **node-http-proxy** (npm: `node-http-proxy`)
- **rotating-proxies** pattern with fetch + AbortController

---

## Part 10 — Coverage Summary

| Category | Total URLs | Deep-read |
|---|---|---|
| Workflow orchestration | ~35 | 22 (all run/workflow-method/state pages) |
| Agent runtime | ~30 | 5 (agent, generate, generateLegacy, network, MastraModelOutput) |
| Streaming | ~15 | 5 (stream, resumeStream, observeStream, timeTravelStream, MastraModelOutput) |
| RAG / vectors / memory | ~65 | 0 (path+title classification only) |
| Processors / guardrails | ~20 | 0 |
| Storage / observability | ~45 | 0 |
| Model providers / gateways | ~150 | 0 |
| Browser automation | ~8 | 0 |
| Workspace / sandboxes | ~20 | 0 |
| Auth / server / deploy | ~50 | 0 |
| Evals / datasets | ~40 | 0 |
| Templates/guides/blog/learn | ~400 | 0 |
| Other (meta, podcasts, etc.) | ~257 | 0 |
| **TOTAL** | **1135** | **30** |

All 30 pre-selected feature/API pages were successfully deep-read. No pages errored.
