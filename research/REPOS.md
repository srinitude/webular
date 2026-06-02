# webular — Consolidated Repo Manifest (opensrc cache)

Consolidated manifest of every service's GitHub repos and what was fetched into the local opensrc cache at `/Users/kiren/.opensrc/repos/github.com/<owner>/<repo>/<branch>`.

Generated: 2026-06-02. Per-service raw manifests live in `research/raw/<Service>.repos.md`.

---

## Totals

| Service | Org(s) | Repos found | Fetched | Skipped |
|---|---|--:|--:|--:|
| Firecrawl | `firecrawl` (`mendableai` empty) | 100 | 35 | 65 |
| Exa | `exa-labs`, `metaphorsystems` (`exa-ai` empty) | 89 | 19 | 70 |
| Perplexity | `perplexityai`, `perplexity-ai` (`ppl-ai` empty) | 40 | 24 | 16 |
| Tavily | `tavily-ai` | 32 | 11 | 21 |
| Parallel | `parallel-web` | 15 | 11 | 4 |
| Nimble | `Nimbleway` | 36 | 9 | 27 |
| Brave | `brave`, `brave-intl` | 101 | 56 | 45 |
| Bun | `oven-sh` | 30 | 14 | 16 |
| Mastra | `mastra-ai` | 100 | 24 | 76 |
| Mermaid | `mermaid-js` | 10 | 6 | 4 |
| mise | `jdx` | 509 | 19 | 490 |
| **TOTAL** | | **1062** | **228** | **834** |

Skip rationale (consistent across services): forks of upstream libs, giant monorepos (Chromium 63 GB, nixpkgs 5.5 GB, langchain/n8n/crewAI forks), demo/example apps, dated workshop stubs, internal infra/CI tooling, datasets, and docs-only repos. Fetched = own SDKs, MCP servers, core engines, reusable libraries, and high-signal reference implementations.

---

## Web-data products — key fetched repos

### Firecrawl (`firecrawl/`, 35 fetched)
Core + reusable Rust libs + reference implementations.
- **Core engine:** `firecrawl/firecrawl` (TS, 127k★ — the scrape/search/crawl API)
- **Reusable Rust libs (HIGH VALUE for webular):** `pdf-inspector` (PDF classify+extract), `html-extractor` (page-type-aware main content→md, Node bindings), `simd-html-to-md` (SIMD HTML→md), `nodesig` (HTML node signaturing)
- **MCP / CLI:** `firecrawl-mcp-server`, `cli`, `firecrawl-claude-plugin`, `opencode-firecrawl`
- **SDKs:** `firecrawl-py`, `firecrawl-go`, `firecrawl-java-sdk`, `firecrawl-php`
- **Reference impls:** `firesearch` (deep research+LangGraph), `open-researcher` (visual research), `web-agent` (structured web research), `fire-enrich` (data enrichment), `open-scouts`+`firecrawl-observer` (change monitoring), `fireplexity` (Perplexity-clone search), `firestarter` (RAG chatbot), `open-agent-builder` (visual workflow), `open-lovable` (site→React clone), `llmstxt-generator`/`create-llmstxt-py`, `data-connectors`, `mineru-api` (doc extraction)
- Skipped: 65 (forks of html-to-markdown/lopdf/calamine/mcp-sdk, demos, Mendable legacy bots).

### Exa (`exa-labs/`, `metaphorsystems/`, 19 fetched)
- **SDKs:** `exa-js`, `exa-py`, `metaphorsystems/metaphor-go` (legacy)
- **MCP:** `exa-mcp-server` (4.5k★), `websets-mcp-server`
- **Integrations:** `ai-sdk` (Vercel), `exa-dspy`, `exa-haystack`, `langchain`-adjacent, `n8n-integration`, `dify-exa`, `ibm-exa`, `exa-for-sheets`, `exa-airtable`, `exa-cursor-plugin`, `zed-exa-mcp-extension`, `kiro-power-exa`
- **Specs/bench:** `openapi-spec`, `benchmarks` (search-API eval)
- Skipped: 70 (44 infra/ML forks incl. nixpkgs 5.5 GB; 22 demo apps incl. `company-researcher`).

### Perplexity (`perplexityai/`, `perplexity-ai/`, 24 fetched)
- **SDKs:** `perplexity-py`, `perplexity-node`, `pplx-rs`, `ai-sdk`
- **MCP:** `modelcontextprotocol` (2.2k★ — official MCP server)
- **Eval/cookbook:** `search_evals`, `api-cookbook`
- **Infra/inference (own, not web):** `pplx-garden`, `pplx-kernels`, `bumblebee` (supply-chain scanner), `codescythe` (TS dead-code), Bazel utils (`gazelle_py`,`toolchain_utils`,`download_utils`,`ape`,`rules_diff`), `pgcat` fork, `libfabric-efa-demo`, `webRTC`, `eslint-plugins`
- Skipped: 16 (Swift/JS forks of next-auth/dd-trace/Factory/Eppo SDKs).

### Tavily (`tavily-ai/`, 11 fetched)
- **SDKs:** `tavily-python` (1.3k★ — search/extract/crawl/map/research), `tavily-js`
- **MCP:** `tavily-mcp` (2k★)
- **Integrations/skills:** `langchain-tavily`, `ai-sdk`, `tavily-n8n-node`, `skills`, `tavily-cursor-plugin`, `NeMo-Agent-Toolkit-tavily`, `tavily-agentCore-mcp`, `tavily-search-evals`
- Skipped: 21 (demo apps, cookbooks, large langchainjs/crewAI/n8n/dify forks).

### Parallel (`parallel-web/`, 11 fetched)
- **SDKs:** `parallel-sdk-typescript`, `parallel-sdk-python`, `parallel-npm-packages`
- **CLI/tools:** `parallel-web-tools` (incl. parallel-cli)
- **MCP/integrations:** `task-mcp`, `parallel-agent-skills`, `langchain-parallel`, `parallel-google-adk`, `parallel-n8n-nodes`
- **Docs/context:** `parallel-llms-txt`, `parallel-sdk-overview`
- Skipped: 4 (cookbook notebooks, homebrew-tap, cursor-plugin, demo app).

### Nimble (`Nimbleway/`, 9 fetched)
- **SDKs:** `nimble-python`, `nimble-typescript`, `nimble-go`, `nimble-cli`
- **Integrations/skills:** `langchain-nimble`, `scrapy-nimble`, `agent-skills`, `cookbook`, `alerts-agent`
- Skipped: 27 (cookbook example apps, infra/OCI tooling, hiring repos, forks of langchain/browser-use/puppeteer-cluster).

### Brave (`brave/`, `brave-intl/`, 56 fetched)
Most fetched of the data products — many reusable Rust web/privacy libs.
- **Search MCP/CLI/skills:** `brave-search-mcp-server` (1.1k★), `brave-search-cli` (Rust), `brave-search-skills`, `brave-search-extension`, `n8n-nodes-brave-search`, `goggles-quickstart`
- **Reusable Rust web libs (HIGH VALUE):** `kuchikiki` (HTML tree manipulation), `adblock-rust` (ad/tracker stripping for clean scrape), `pagegraph-rust`
- **Adblock data:** `adblock-lists`, `adblock-resources`, `slim-list-lambda`, `sugarcoat-resources`
- **Privacy protocols (own, not web-scrape):** `sta-rs`, `constellation`(+processors), `challenge-bypass-ristretto`(+ffi/wasm), `miracl-rs`, `star-randsrv`, `vsock-relay`
- **Infra/services:** `go-sync`, `go-update`, `go-translate`, `accounts`, `bat-go`, `brave-variations`, `ocelot` (model), plus design (`leo`), docs, and misc.
- Skipped: 45 (Chromium 63 GB, brave-core 4.4 GB, uBlock/catapult/omaha forks, datasets, CI configs).

---

## Foundation tooling — key fetched repos

### Bun (`oven-sh/`, 14 fetched)
- **Runtime:** `bun` (Rust, 92k★ — the runtime/bundler/test-runner/pm webular builds on)
- **Tooling:** `setup-bun`, `homebrew-bun`, `docker`, `bun-development-docker-image`, `bun-dependencies`, `bun-ecosystem-ci`, `bun.report`, `security-scanner-template`, `bun-releases-for-updater`, `bun-pypi`, `zig-npm`, `style-guide`, `awesome-bun`
- Skipped: 16 (WebKit 11.6 GB, zig/boringssl/libuv/mimalloc forks, benchmark datasets).

### Mastra (`mastra-ai/`, 24 fetched)
- **Core:** `mastra` (TS, 24k★ — workflow/agent/tool framework)
- **Skills:** `skills`, `skills-api`
- **Reference templates (HIGH VALUE):** `template-browsing-agent` (Stagehand web automation/scraping), `template-deep-research` (workflows+HITL), `template-deep-search`, `template-coding-agent` (sandbox exec), `workflow-builder-template`, `kitchen-sink-example`, `rag-workshop-code`, `mastra-agent-course`
- **MCP:** `discord-mcp-server`, `discord-mcp-bot`, MCP workshops
- **Misc:** `node-audio`, `ui-dojo`, `mastra-agui-dojo`, `personal-assistant-example`, `voice-examples`, `mastra-auth-examples`, `mastra-triage`, `text-to-sql-example`
- Skipped: 76 (dozens of dated/duplicate weather-agent + text-to-sql + workshop stubs, narrow single-purpose templates, HTML slide decks, media apps).

### Mermaid (`mermaid-js/`, 6 fetched)
- **Engine:** `mermaid` (TS, 88k★ — diagram DSL→SVG)
- **CLI:** `mermaid-cli` (`mmdc`, 4.6k★)
- **Support:** `mermaid-live-editor`, `react-wrapper`, `dagre-d3` (layout renderer), `api-integration-ex`
- Skipped: 4 (zenuml-core fork 134 MB, bot, .github, GH-pages placeholder).

### mise (`jdx/`, 19 fetched)
- **Core:** `mise` (Rust, 28k★ — dev tools/env/task runner)
- **Companion tools:** `fnox` (secret manager), `hk` (git hooks/lints), `usage` (CLI spec lib — HIGH VALUE if mirroring task CLI), `demand` (Rust prompts), `clx` (CLI UX), `xx` (shell exec), `expr.rs` (task expressions), `pklr` (pkl config), `deepmerge`, `communique`, `go-netrc`, `mise-action`
- **Plugin templates:** `mise-tool-plugin-template`, `mise-backend-plugin-template`, `mise-env-plugin-template`, `mise-env-fnox`, `vfox-npm`, `mise-versions`
- Skipped: 490 (overwhelmingly jdx's old personal projects — Angular/MEAN/Ruby CRM demos, vim configs — plus large datasets `mise-analytics` 305 MB / `mise-java` 174 MB).

---

## opensrc path convention

All fetched repos are cached at:
```
/Users/kiren/.opensrc/repos/github.com/<owner>/<repo>/<branch>
```
Branch varies per repo (`main`/`master`/`develop`/`staging` or feature branch — see per-service raw manifest for exact path). Notable engines:
- `/Users/kiren/.opensrc/repos/github.com/firecrawl/firecrawl/main`
- `/Users/kiren/.opensrc/repos/github.com/firecrawl/pdf-inspector/main`
- `/Users/kiren/.opensrc/repos/github.com/firecrawl/html-extractor/main`
- `/Users/kiren/.opensrc/repos/github.com/brave/kuchikiki/main`
- `/Users/kiren/.opensrc/repos/github.com/brave/adblock-rust/master`
- `/Users/kiren/.opensrc/repos/github.com/mastra-ai/mastra/main`
- `/Users/kiren/.opensrc/repos/github.com/oven-sh/bun/main`
- `/Users/kiren/.opensrc/repos/github.com/mermaid-js/mermaid/develop`
- `/Users/kiren/.opensrc/repos/github.com/mermaid-js/mermaid-cli/master`
- `/Users/kiren/.opensrc/repos/github.com/jdx/mise/main`
