# Best practices checklist

This list names the practices webular follows for each library and tool it uses, plus practices that hold for any TypeScript CLI. Each item names its source, the source's date, and how the item is checked. A final audit across every branch uses this list.

How to read each item:

- **Automated** means a test fails if the practice breaks. Most live in [`tests/quality/practices-config.test.ts`](../tests/quality/practices-config.test.ts) and [`tests/quality/practices-source.test.ts`](../tests/quality/practices-source.test.ts), and they run in `mise run test`, inside the `mise run ci` chain.
- **Review** means a person or agent checks it, because no rule can decide it.
- **Open** means the practice is not met. The item says which branch picks it up.
- "Undated" means the source page shows no date. A source dated earlier than the pinned package is marked "predates the pin".

## Toolchain: Bun, mise, GitHub Actions, TypeScript, Biome

- [x] **Strict TypeScript flag set**: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`. Source: <https://www.typescriptlang.org/tsconfig> (undated). Check: automated, `tsconfig keeps the strict flag set`.
- [x] **`erasableSyntaxOnly`**, so Bun can run every file by stripping types, with no enums or namespaces. Source: <https://www.typescriptlang.org/tsconfig#erasableSyntaxOnly> (2025-02, predates the pin). Check: automated, same test, plus `tsc --noEmit`.
- [x] **`exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`**. Source: <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html> (page updated 2026-10-19). Check: automated, `tsconfig keeps the strict flag set`, plus `tsc --noEmit`.
- [x] **Every action pinned to a full commit SHA** with a version comment. Source: <https://docs.github.com/en/actions/reference/security/secure-use> (undated). Check: automated, `every action is pinned to a full commit SHA`.
- [x] **Read-only token, never persisted, no `pull_request_target`**. Source: <https://docs.zizmor.sh/audits/> (2026-07). Check: automated, `token is read-only, not persisted, and the job has a timeout`.
- [x] **A `timeout-minutes` on every job**, since the default is 360. Source: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax> (undated). Check: automated, same test.
- [x] **Dependabot for actions and npm**, so pins stay current. Source: <https://docs.github.com/en/code-security/dependabot> (undated). Check: automated, `dependabot keeps action and npm pins current`.
- [x] **Frozen lockfile installs**, through `bun install --frozen-lockfile` in the mise `setup` task. Source: <https://bun.com/docs/pm/cli/install> (undated). Check: review of [`mise.toml`](../mise.toml).
- [x] **`engines.bun` matches the mise Bun pin**. Source: <https://docs.npmjs.com/cli/configuring-npm/package-json#engines> (undated). Check: automated, `engines.bun matches the mise bun pin`.
- [x] **Bun `minimumReleaseAge`** in [`bunfig.toml`](../bunfig.toml), so a malicious release can't land the hour it ships. The window is one day (`86400` seconds), short enough that every pinned version still resolves. Source: <https://bun.com/docs/runtime/bunfig> (undated). Check: automated, `bunfig.toml sets a minimumReleaseAge of at least one day`.
- [x] **mise lockfile in locked mode**, with `[settings] lockfile = true`, a committed [`mise.lock`](../mise.lock) that lists Bun for `linux-x64`, `macos-arm64`, and `windows-x64`, and `MISE_LOCKED=1` in CI. Source: <https://mise.jdx.dev/dev-tools/mise-lock.html> (undated). Check: automated, `mise installs only what mise.lock records, for every CI platform`.
- [ ] **Biome rules promoted in Biome 2.5**: `noUnnecessaryConditions`, `noShadow`, `useErrorCause`, `noFloatingPromises`. Source: <https://biomejs.dev/blog/biome-v2-5/> (2026-06-05). Check: open. Turn them on once the Effect conversion lands, since they flag Promise code that branch removes.

## Effect and XState

- [x] **`effect` pinned to one exact version, with `@effect/platform-bun` on the same version**. Source: <https://www.npmjs.com/package/@effect/platform-bun> (2026-10-15). Check: automated, `effect packages share one exact version`.
- [x] **No Effect 3 packages** (`@effect/schema`, `@effect/cli`, `@effect/platform`) and no beta-only `effect/unstable/*` paths. CLI, Schema, and Config come from `effect` itself. Source: <https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json> (2026-10-21). Check: automated, `no Effect 3 packages or beta-only Effect paths`.
- [ ] **Services as `Context.Service`, methods as `Effect.fn("Name.method")`, errors as `Schema.TaggedError`, settings through `Config`**. Source: <https://github.com/Effect-TS/effect/tree/main/ai-docs/src/01_effect> (2026-10-21). Check: open, for the Effect conversion branch.
- [ ] **Run once at the edge** with `BunRuntime.runMain` and the `BunServices` layer. Tests use one `ManagedRuntime` per file. Source: <https://github.com/Effect-TS/effect/tree/main/packages/platform/bun/src> (2026-10-21). Check: open for [`src/`](../src/). The test helper [`tests/_support/repo-files.ts`](../tests/_support/repo-files.ts) follows it.
- [x] **Effect language service plugin** in [`tsconfig.json`](../tsconfig.json). Source: <https://github.com/Effect-TS/language-service> (2026-10-16). Check: review. `@effect/language-service` is pinned in [`package.json`](../package.json) and listed in [`tsconfig.json`](../tsconfig.json) plugins.
- [x] **No pre-`setup` XState APIs**: `Machine(`, `interpret(`, `withConfig(`, typegen. Source: <https://stately.ai/docs/migration> (undated). Check: automated, `no XState v4 APIs`.
- [ ] **XState machines built with `setup({ types, actions, guards, actors })` and run through `createActor`**. Source: <https://stately.ai/docs/setup> (undated; the stable release is `5.33.3`, published 2026-10-17). Check: review, for the state-machine branch.

## Mastra, MCP SDK, zod

- [x] **zod top-level string formats**: `z.url()`, not `z.string().url()`, and `z.looseObject()`, not `.passthrough()`. Source: <https://zod.dev/v4/changelog> (undated). Check: automated, `zod 4 top-level string formats, no passthrough, no nativeEnum`.
- [ ] **MCP tools declare `title`, `outputSchema`, and `annotations`** (`readOnlyHint`, `openWorldHint`), and return `structuredContent`. Source: <https://modelcontextprotocol.io/specification/2025-11-25/server/tools> (2025-11-25, predates the pin). Check: open, for the agent-plugin branch.
- [ ] **Tool failures return `isError: true`**, not a throw. JSON-RPC errors are only for protocol faults. Source: same spec page. Check: open, for the agent-plugin branch.
- [ ] **On stdio, stdout carries only JSON-RPC**, and logs go to stderr. Source: <https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md> (undated). Check: review of [`src/commands/mcp.ts`](../src/commands/mcp.ts).
- [ ] **Mastra workflows use `createStep` and `createWorkflow(...).then(...).commit()`** with input and output schemas. Source: <https://mastra.ai/docs/workflows/overview> (undated). Check: review.

## Page and document libraries

- [x] **No `@types` package for a library that ships its own types**: `diff`, `effect`, `zod`, `mammoth`, `@mozilla/readability`. Source: <https://github.com/kpdecker/jsdiff/blob/master/release-notes.md> (undated). Check: automated, `no @types package for a library that ships its own types`.
- [x] **Readability: run `isProbablyReaderable` first**, and clone the document before `parse()`, since parsing changes it. Source: <https://github.com/mozilla/readability/blob/main/README.md> (undated). Check: automated, [`tests/engine/html.test.ts`](../tests/engine/html.test.ts) (the non-readerable fallback). Nothing reads the document after `parse()`, so no clone is needed.
- [x] **Sanitize Readability and mammoth HTML** before anyone embeds it. Neither library sanitizes. Source: same README, and <https://github.com/mwilliamson/mammoth.js/blob/master/README.md> (undated). Check: automated, [`tests/engine/html.test.ts`](../tests/engine/html.test.ts), which covers the shared `sanitizeHtml` helper in [`src/lib/html.ts`](../src/lib/html.ts).
- [x] **unpdf: free the PDF proxy** with `destroy()` in a finalizer. Source: <https://github.com/unjs/unpdf/blob/main/README.md> (undated; `destroy` comes from pdf.js and is not in that README). Check: review of [`src/lib/parse.ts`](../src/lib/parse.ts), which frees it through `Effect.acquireRelease`.
- [x] **mammoth: surface `messages`**, its warnings and errors. Source: mammoth README (undated). Check: review of [`src/lib/parse.ts`](../src/lib/parse.ts), which logs them to stderr.
- [x] **p-limit: use `limit.map(items, fn)`** over `Promise.all(items.map(...))`. Source: <https://github.com/sindresorhus/p-limit/blob/main/readme.md> (undated). Check: review. No `p-limit` or `Promise.all` pool remains in `src`; `batch`, `crawl`, `map` and `sources` use `Effect.forEach` with a `concurrency` bound.

## Practices for any TypeScript CLI

- [x] **Color never carries meaning alone.** The only color is the red `error:` label, and the word says the same thing. `NO_COLOR` turns color off and wins over `FORCE_COLOR`. A pipe or `TERM=dumb` gets no color. Source: <https://no-color.org> (undated). Check: automated, `ANSI color lives only in src/cli/style.ts, so no meaning rides on color alone` and `NO_COLOR wins over FORCE_COLOR`.
- [x] **Data goes to stdout, messages go to stderr, and `--json` gives the machine shape.** Source: <https://clig.dev/#output> (undated). Check: review of [`src/core/output.ts`](../src/core/output.ts), plus the CLI tests.
- [x] **Exit codes are documented**: `0`, `1`, `2`, `3`, `127`. Source: <https://clig.dev/#the-basics> (undated). Check: automated, `README documents the exit codes the CLI uses`.
- [x] **Exit codes match the docs.** An unknown command returns `2`; `doctor` returns `1` when a required check fails. Source: same. Check: automated, `an unknown command exits 2 with a usage hint` and `exits 1 when a required check fails`.
- [x] **Every release has a changelog entry** in Keep a Changelog form. Source: <https://keepachangelog.com/en/1.1.0/> (undated). Check: automated, `CHANGELOG.md has an entry for the package version`.
- [x] **Semantic versioning.** Source: <https://semver.org/spec/v2.0.0.html> (undated). Check: review at each release.
- [x] **A public security policy.** Source: <https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository> (undated). Check: automated, same test as the changelog.
- [x] **Every path in `files` exists, and the changelog ships.** Source: <https://docs.npmjs.com/cli/configuring-npm/package-json#files> (undated). Check: automated, `every path in files exists and CHANGELOG.md ships`.
- [x] **Small units**: 200 lines per file, 30 per construct, nesting depth 3 or less. Source: the repo's own rule. Check: automated, [`tests/quality/limits.test.ts`](../tests/quality/limits.test.ts).
- [x] **No dead exports.** Source: the repo's own rule. Check: automated, [`tests/quality/exports.test.ts`](../tests/quality/exports.test.ts).
- [x] **No secrets in code**, and `.env` files are git-ignored. Source: <https://12factor.net/config> (undated). Check: review of `.gitignore`.
- [x] **Deterministic tests**: temp paths come from `mkdtemp`, not `Date.now()`. Source: <https://12factor.net/dev-prod-parity> (undated). Check: review, through the `tmpDir` helper in [`tests/_support/run.ts`](../tests/_support/run.ts), in [`tests/cli/render.test.ts`](../tests/cli/render.test.ts), [`tests/commands/monitor.test.ts`](../tests/commands/monitor.test.ts), [`tests/commands/media.test.ts`](../tests/commands/media.test.ts).
- [x] **Typed errors with a distinct exit code per kind.** Source: <https://clig.dev/#errors> (undated). Check: automated, [`tests/cli/exit-codes.test.ts`](../tests/cli/exit-codes.test.ts). `failureOf` in [`src/core/effect.ts`](../src/core/effect.ts) matches on `_tag`: `CliError` keeps its code (usage is 2), `ProcError` is 127, the rest are 1.
