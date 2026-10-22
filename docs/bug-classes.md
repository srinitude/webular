# Bug classes

Webular runs on Bun, Effect 4, Mastra workflows, XState, and Jev. It fetches pages it does not trust, and agents drive it as a CLI and as an MCP server. Each of those parts has its own kinds of bugs. This page lists each kind, where it can show up in webular, and what guards against it.

`mise run bugs:static` runs the static guards in [scripts/bugs-check.ts](../scripts/bugs-check.ts). Each `bugs:<class>` task runs one class's tests, listed in [bugs-hunts.json](../scripts/bugs-hunts.json), and prints every missing guard. `mise run bugs:check` runs both on the CI spine after `test`. [bugs-check.test.ts](../tests/quality/bugs-check.test.ts) proves each guard fails on a planted bad line and passes once the line is gone. A class marked "not guarded yet" names the bug hunt that owns it. Sources were read on 2026-10-21 unless a source gives its own date.

Tasks by class: `bugs:security` (8, 10, 11), `bugs:effect` (4, 7), `bugs:mcp-cli` (1, 2, 3), `bugs:parsing` (6, 9, 12), `bugs:tests-build` (5, 16, 17), `bugs:jev` (14, 15), `bugs:os` (13), and `bugs:cross-branch` (18). Class 19 has no task yet; its tests run with `mise run test:file tests/lib`.

## Before you merge

- [ ] `mise run bugs:check` passes, and every rule's `known` list stays the same or shorter.
- [ ] Nothing on the MCP server path writes to stdout. Logs go to stderr.
- [ ] Every outside input (JSON, page text, env, tool arguments) is decoded with a schema, never cast.
- [ ] Every network call and child process has a timeout, and every child gets an argv array.
- [ ] Crawl and scrape read robots.txt before the first page on a host.
- [ ] Home paths fall back from `HOME` to `USERPROFILE`, and paths are joined with `node:path`.
- [ ] URL changes keep one canonical form, and tracking-param tests use a real tracking name such as `ref_src`.
- [ ] A change to the sanitizer or the archive fallback keeps page facts: formulas, code-block line breaks, and only 200-status HTML captures.
- [ ] Docs, AGENTS.md files, machines, and tool descriptions match the code in the same commit.
- [ ] Two branches that touch the same string (the MCP instructions, a tool description) are joined by hand, and the joined text is tested.
- [ ] Tests wait on events, use port 0 and their own temp folder, and pass under `bun test --parallel`.

## 1. Stdout writes on the MCP server

- Risk: an MCP stdio server may write only JSON-RPC to stdout. One log line or banner breaks the stream, and the client drops the server.
- Where: [src/commands/mcp.ts](../src/commands/mcp.ts), [src/machines/mcp-serve.ts](../src/machines/mcp-serve.ts), [plugins/webular/src](../plugins/webular/src/).
- Guard: `bugs:check` rule "MCP stdout carries only JSON-RPC". [mcp.test.ts](../tests/commands/mcp.test.ts) checks the server's replies.
- Sources: [MCP stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio); [daedra issue 4](https://github.com/dirmacs/daedra/issues/4).

## 2. MCP cancellation, timeouts, large results, and schema drift

- Risk: a tool that ignores a cancel keeps working for nobody. A huge result blows past the client's limit. A tool schema that changes without notice breaks callers.
- Where: [plugins/webular/src/server.ts](../plugins/webular/src/server.ts), [plugins/webular/src/budget.ts](../plugins/webular/src/budget.ts), [plugins/webular/src/schemas.ts](../plugins/webular/src/schemas.ts).
- Guard: the tools/list budget of 4850 tokens and [tests/contract](../tests/contract/) for tool names. Cancellation is not guarded yet (owner: the MCP and CLI protocol hunt).
- Sources: [MCP stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio).

## 3. CLI exit codes, SIGPIPE, SIGINT, and NDJSON flushing

- Risk: `webular … | head` raises EPIPE instead of a quiet exit. `process.exit()` right after a write can cut the last NDJSON line. Ctrl-C should exit 130.
- Where: [src/core/output.ts](../src/core/output.ts), [src/cli/dispatch.ts](../src/cli/dispatch.ts), [src/cli/run.ts](../src/cli/run.ts).
- Guard: [exit-codes.test.ts](../tests/cli/exit-codes.test.ts), plus [dispatch.test.ts](../tests/cli/dispatch.test.ts) for SIGINT and SIGTERM, even a SIGTERM during startup. EPIPE and flush on exit are not guarded yet (owner: the MCP and CLI protocol hunt).
- Sources: [EPIPE when piping to head](https://stackoverflow.com/questions/12329816/error-write-epipe-when-piping-node-output-to-head); [standard IO in Node](https://www.thenodebook.com/process-os/standard-io).

## 4. Shell strings and child processes

- Risk: a command built as one string lets spaces and metacharacters run other commands. A child with no timeout can hang the run.
- Where: [src/core/proc.ts](../src/core/proc.ts) (argv only, mandatory timeout), [src/release/node-launcher.ts](../src/release/node-launcher.ts).
- Guard: `bugs:check` rule "no shell strings". [proc.test.ts](../tests/core/proc.test.ts), [proc-child-cap.test.ts](../tests/core/proc-child-cap.test.ts), and [proc-process-group.test.ts](../tests/core/proc-process-group.test.ts), which checks that a grandchild dies on timeout and on cancel.
- Sources: [Bun child processes](https://bun.com/docs/runtime/child-process).

## 5. Fetch without a timeout

- Risk: Bun's `fetch` has no default timeout, and `AbortSignal.timeout` has been reported not to fire on an unreachable host.
- Where: every request goes through [src/core/http.ts](../src/core/http.ts), which sets `AbortSignal.timeout`.
- Guard: `bugs:check` rule "no raw fetch". [http-client.test.ts](../tests/core/http-client.test.ts) and [fault-injection.test.ts](../tests/core/fault-injection.test.ts).
- Sources: [oven-sh/bun issue 13302](https://github.com/oven-sh/bun/issues/13302); [MDN AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static).

## 6. Casts at trust boundaries

- Risk: `JSON.parse(x) as T` or `as any` trusts bytes from a page, a file, or a child process. A wrong shape fails far from where it came in.
- Where: every boundary. Known casts: [commands.ts](../plugins/webular/src/commands.ts), [crawl-resume.ts](../src/lib/crawl-resume.ts), [sources-search.ts](../src/lib/sources-search.ts), [tasks.ts](../src/workflows/tasks.ts).
- Guard: `bugs:check` rules "no `as any`" and "decode JSON with a schema". The four known files are listed in the rule (owner: the parsing, URLs, and encoding hunt).
- Sources: [Effect Schema](https://effect.website/docs/schema/introduction/).

## 7. Effect defects, interruption, scopes, and layers

- Risk: `orDie` turns a typed failure into a defect that `catch` never sees. A resource without a scope leaks on interrupt. A layer provided twice is built twice. `Effect.all` over a dynamic list with no bound can open too many sockets.
- Where: [src/core/effect.ts](../src/core/effect.ts), [src/workflows/runtime.ts](../src/workflows/runtime.ts), [src/cli/run.ts](../src/cli/run.ts), [src/lib/jev/run.ts](../src/lib/jev/run.ts).
- Guard: [no-nested-run.test.ts](../tests/core/no-nested-run.test.ts), [run-dispose.test.ts](../tests/cli/run-dispose.test.ts), and the retired-names rule in [rule-greps.test.ts](../tests/quality/rule-greps.test.ts). Unbounded concurrency is not guarded yet (owner: the Effect, concurrency, and resources hunt).
- Sources: [Effect layer memoization](https://effect.website/docs/v4/requirements-management/layer-memoization); [Effect Layer API](https://www.effect.website/docs/v4/api/effect/Layer).

## 8. SSRF and redirects

- Risk: a URL from a user, an agent, or injected page text can reach localhost, a private network, or cloud metadata. A redirect can move a public URL to a private one. Each redirect hop needs the same check, and loops need a cap.
- Where: [src/core/http.ts](../src/core/http.ts) (redirects follow by default), [src/lib/local-index.ts](../src/lib/local-index.ts) (search results drop private hosts).
- Guard: [private-hosts.test.ts](../tests/core/private-hosts.test.ts) covers search results. [private-address.security.test.ts](../tests/lib/private-address.security.test.ts) covers scrape and fetch targets and every redirect hop.
- Sources: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html); [RFC 9110, section 15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4).

## 9. Huge pages, gzip bombs, and charset

- Risk: an unbounded body or a small gzip file that expands to gigabytes eats memory. A wrong charset garbles text.
- Where: [src/core/decode.ts](../src/core/decode.ts), [src/core/gunzip.ts](../src/core/gunzip.ts), [src/core/http-body.ts](../src/core/http-body.ts).
- Guard: [fetch-body-cap.test.ts](../tests/core/fetch-body-cap.test.ts), [map-gzip.test.ts](../tests/engine/map-gzip.test.ts), [decode.test.ts](../tests/engine/decode.test.ts), [parse-pdf-caps.test.ts](../tests/engine/parse-pdf-caps.test.ts). [pdf-load-options.effect.test.ts](../tests/lib/pdf-load-options.effect.test.ts) checks that a PDF load or a docx conversion that never settles fails at its deadline.
- Sources: [CWE-409](https://cwe.mitre.org/data/definitions/409.html); [WHATWG Encoding](https://encoding.spec.whatwg.org/).

## 10. Robots.txt order, rate limits, and Retry-After

- Risk: fetching a page before robots.txt breaks the crawler rules. An unreachable robots.txt (5xx) means disallow all. Ignoring `Retry-After` gets the crawler blocked.
- Where: [src/lib/crawl.ts](../src/lib/crawl.ts), [src/lib/robots-txt.ts](../src/lib/robots-txt.ts), [src/lib/polite-crawler.ts](../src/lib/polite-crawler.ts), [src/core/fetch-policy.ts](../src/core/fetch-policy.ts).
- Guard: [robots-txt.test.ts](../tests/core/robots-txt.test.ts), [polite-crawler.test.ts](../tests/core/polite-crawler.test.ts), [fetch-policy-jitter.test.ts](../tests/core/fetch-policy-jitter.test.ts). The robots-before-root fix (commits `c399cd08`, `1203095a`) and its test live on that fix branch (owner: the security and network hunt).
- Sources: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309); [RFC 6585, section 4](https://www.rfc-editor.org/rfc/rfc6585#section-4).

## 11. Prompt injection in page text

- Risk: page text can carry instructions that steer the model that reads it. Hidden text and invisible characters slip past a reader. An image inside a hidden element, or a very long alt text, carries the same instructions into the image list.
- Where: [src/lib/html.ts](../src/lib/html.ts), [src/lib/parse.ts](../src/lib/parse.ts), [src/lib/html-images.ts](../src/lib/html-images.ts), every Jev or model call that reads page text.
- Guard: [sanitize-injection.test.ts](../tests/engine/sanitize-injection.test.ts). Hidden images and the 300-character alt cap: the image-list case in [invisible-titles.security.test.ts](../tests/lib/invisible-titles.security.test.ts).
- Sources: [OWASP LLM01 prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/); [OWASP prompt injection cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

## 12. URL and Unicode normalization

- Risk: two code paths that strip tracking params differently give two keys for one page. A bare `ref` can be a real page parameter. Hosts must be compared in punycode form, and text in NFC.
- Where: [src/core/url.ts](../src/core/url.ts), [src/lib/search.ts](../src/lib/search.ts).
- Guard: [canonical-url.test.ts](../tests/engine/canonical-url.test.ts), [url.test.ts](../tests/engine/url.test.ts), [search-hitkey.test.ts](../tests/lib/search-hitkey.test.ts), from commits `c2a7b5e0`, `abd12f4a`, and `aa2c1a58`.
- Sources: [WHATWG URL](https://url.spec.whatwg.org/); [UTS 46](https://www.unicode.org/reports/tr46/); [UAX 15](https://www.unicode.org/reports/tr15/).

## 13. Cross-platform paths and home folders

- Risk: Windows sets `USERPROFILE`, not `HOME`, so a `HOME`-only read writes caches into the working folder. A hard-coded `/` breaks on Windows.
- Where: [src/lib/fetch-layer.ts](../src/lib/fetch-layer.ts), [src/lib/jev/docs-cache.ts](../src/lib/jev/docs-cache.ts), [src/lib/local-index-path.ts](../src/lib/local-index-path.ts), [src/lib/jev/learn/recorder.ts](../src/lib/jev/learn/recorder.ts), [src/core/cache.ts](../src/core/cache.ts).
- Guard: [platform-parity.test.ts](../tests/core/platform-parity.test.ts), [file-url-paths.test.ts](../tests/core/file-url-paths.test.ts). The `USERPROFILE` fallback (commit `05ae9067`) and its test live on that fix branch (owner: the cross-platform hunt).
- Sources: [Node path, Windows vs POSIX](https://nodejs.org/api/path.html#windows-vs-posix); [Node os.homedir](https://nodejs.org/api/os.html#oshomedir).

## 14. Mastra workflow and XState machine drift

- Risk: resuming a child run instead of its parent fails with "not suspended". Resume data that drifts from the step's schema fails late. A machine that nobody checks against the code stops describing it.
- Where: [src/workflows](../src/workflows/), [src/workflows/runtime.ts](../src/workflows/runtime.ts), [src/machines](../src/machines/).
- Guard: [tests/workflows](../tests/workflows/), the model-based tests in [tests/machines](../tests/machines/), [machine-replay.test.ts](../tests/jev/machine-replay.test.ts), and the declarative-config rule in [rule-greps.test.ts](../tests/quality/rule-greps.test.ts). Resume-schema drift is not guarded yet (owner: the Jev decisions and state machines hunt).
- Sources: [Mastra resume reference](https://mastra.ai/en/reference/workflows/resume); [Mastra "not suspended" error](https://dev.to/devamaz/mastra-this-workflow-run-was-not-suspended-error-4o3a); [Stately xstate-test](https://stately.ai/docs/xstate-test).

## 15. Decision-model fallbacks

- Risk: a Jev call that times out or returns a bad shape falls back without a trace, so a regression hides behind the fallback rate. A loose model pin moves the model under you.
- Where: [src/lib/jev](../src/lib/jev/), [src/lib/jev/client.ts](../src/lib/jev/client.ts), [src/lib/jev/model.ts](../src/lib/jev/model.ts), [src/lib/jev/define.ts](../src/lib/jev/define.ts).
- Guard: [definition-lint.test.ts](../tests/jev/definition-lint.test.ts) and the Jev evals in [tests/jev](../tests/jev/). Fallback logging is not guarded yet (owner: the Jev decisions and state machines hunt).
- Sources: [silent failures taxonomy](https://arxiv.org/pdf/2606.14589); [when an LLM pipeline silently returns zero](https://gorelik.net/2026/05/18/when-your-llm-pipeline-silently-returns-zero), 2026-05-18.

## 16. Flaky tests and load timeouts

- Risk: fixed sleeps, fixed ports, and shared temp paths pass on an idle machine and fail under load or `--parallel`.
- Where: [tests](../tests/), [bunfig.toml](../bunfig.toml).
- Guard: the port-0 rule in [rule-greps.test.ts](../tests/quality/rule-greps.test.ts), [sandbox.test.ts](../tests/quality/sandbox.test.ts), and [search-determinism.test.ts](../tests/quality/search-determinism.test.ts).
- Sources: [flake pattern reference](https://tessl.io/registry/testland/flake-pattern-reference).

## 17. Supply chain and lockfiles

- Risk: a tampered package runs install scripts, as the Shai-Hulud worm did. A lockfile that drifts installs code nobody reviewed.
- Where: [package.json](../package.json), [bun.lock](../bun.lock), [mise.toml](../mise.toml) (`setup` runs `bun install --frozen-lockfile`).
- Guard: [practices-config.test.ts](../tests/quality/practices-config.test.ts) and [checkout-credentials.test.ts](../tests/ci/checkout-credentials.test.ts).
- Sources: [Upwind on Shai-Hulud 2.0](https://www.upwind.io/?p=14565); [Bun install](https://bun.com/docs/pm/cli/install).

## 18. Docs drift, limits, and branches that collide

- Risk: docs, AGENTS.md files, and tool descriptions go stale when code moves. Two branches that rewrite one string, such as the MCP instructions, each pass alone and clash when joined. A function grows past the 30-line cap.
- Where: every AGENTS.md, [README.md](../README.md), [src/commands/mcp.ts](../src/commands/mcp.ts), [plugins/webular/src/descriptions.json](../plugins/webular/src/descriptions.json).
- Guard: [agents-md.test.ts](../tests/quality/agents-md.test.ts), [markdown-links.test.ts](../tests/quality/markdown-links.test.ts), [limits.test.ts](../tests/quality/limits.test.ts), `mise run docs:links`. A clash on a shared string is not guarded yet (owner: the cross-branch conflicts hunt).
- Sources: [Mintlify on documentation drift](https://www.mintlify.com/library/how-to-stop-documentation-drift).

## 19. Page facts lost in extraction

- Risk: the sanitizer drops foreign elements, so a MathML formula vanishes with its words. Turndown reads a code block's text, so a `<br>` inside `<pre>` glues two lines into one. An archive fallback that keeps error pages, non-HTML files, or the same capture twice returns text that is not the page.
- Where: [src/lib/html-sanitize.ts](../src/lib/html-sanitize.ts) (MathML becomes its alt text, TeX source, or plain text before sanitizing, and a `<br>` in `<pre>` becomes a newline), [src/lib/archive-urls.ts](../src/lib/archive-urls.ts) (the fallback keeps only HTML captures with status 200, once each).
- Guard: "a formula keeps its words when the MathML element is stripped" and "a `<br>` inside a code block stays a line break in Markdown" in [html-extraction.parsing.test.ts](../tests/lib/html-extraction.parsing.test.ts); "archive fallback keeps only same-host HTML captures that returned 200, once each" in [archives.test.ts](../tests/lib/sources/archives.test.ts).
- Sources: [open items](research/open-items.md), extraction rows 8 and 14, and dependency row 56 for turndown.
