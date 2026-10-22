# How webular works

Webular reads the web for you and your agents. This page names each building block and says what it does for you. Blocks that later blocks lean on come first.

## Jev: the judgment calls

Jev is TypeSafe's System One decision model. It makes fast, narrow choices, such as "which of these links matters" or "is this sentence backed by the page".

- Webular sends its judgment calls to Jev. Examples from [`src/lib/jev/decisions/`](../src/lib/jev/decisions/): picking search results (`search.ts`), choosing pages to crawl (`crawl.ts`), checking that an answer cites its source (`answer-citation.ts`), and sorting images (`image-kind.ts`).
- The model is pinned to `jev-1.14.0`, held in one constant in [`src/lib/jev/model.ts`](../src/lib/jev/model.ts).
- One key: Jev (`TYPESAFE_API_KEY`), or the macOS Keychain item `typesafe-ai-api-key`.
- The direct TypeSafe endpoint is the recommended way to reach Jev.
- `WEBULAR_JEV=off` turns Jev off.
- With no key, each decision falls back to a rule-based baseline, so every command still runs.

## Mastra: the agent framework

[Mastra](https://mastra.ai) (`@mastra/core`) gives webular its agents, tools, and workflows in one framework.

## Mastra Workflows: one per command

Each of the 18 commands in [`src/workflows/`](../src/workflows/) is a Mastra workflow built as `createWorkflow(...).then(step).commit()`. Every command runs the same way, so each one is easy to test and trace.

## Mastra MCP server: tools for agents

The MCP server (`@mastra/mcp`) hands webular's commands to any agent that speaks MCP. It runs on your machine.

## Effect: safe steps

Each workflow step runs an [Effect](https://effect.website) program through `stepRuntime` in [`src/workflows/runtime.ts`](../src/workflows/runtime.ts). Effect handles errors, retries, and cleanup for each step.

## XState machines and the Stately agent

The flows in [`src/machines/`](../src/machines/) are XState machines: the command lifecycle, the fetch path, the scrape fallback, and the agent loop. Each machine is tested. The Stately agent keeps the machines and the code in step.

## Bun: the runtime

[Bun](https://bun.sh) runs webular, its tests, and its install.

## Open-source page tools

These turn a raw page or file into clean text:

- Readability (`@mozilla/readability`) finds the main article on a page.
- linkedom gives Readability a light, fast page model to read.
- Turndown turns HTML into Markdown.
- unpdf reads PDF files.
- mammoth reads Word files.
- anydoc reads other document types.

## agent-browser and Cua: real browsers

Some pages only load in a real browser. agent-browser drives one for those pages. Cua drives real apps on your machine in the background. See [Cua browser mode](cua-browser-mode.md).

## mise: one task graph

[mise](https://mise.jdx.dev) holds every build, test, and check as a task with its dependencies. A bare `mise run` runs the whole chain.

## The agent plugin and skills

The plugin in [`plugins/webular`](../plugins/webular/) adds the MCP server and skills to a host that reads plugin marketplaces, such as Claude Code, so an agent can call webular with no extra setup.

## Read next

- [Commands](commands.md)
- [Architecture](architecture.md)
- [Why webular](why-webular.md)
- [Docs index](README.md)
