# Architecture

Read this page to see how a command runs, which XState machines model the CLI
flows, and which guidelines the CLI follows.

## How a command runs

A command passes through these stages, from your shell to the web.

### Pipeline

```text
you ▸ webular CLI ▸ command process (table from mise.toml) ▸ Mastra workflow ▸ Mastra tools ▸ FOSS libs ▸ web
```

### Dispatch

The CLI never imports feature code. It parses argv and looks the command up in
the table built from the `run:<command>` tasks in [`mise.toml`](../mise.toml).
Then it starts that command in its own process at the package root, with the
same Bun that runs the CLI. The command's exit code becomes the CLI's exit
code. The CLI passes a SIGINT or SIGTERM on to the command.

### Task graph

mise owns **one task graph with no cycles**
(`setup → format → lint → typecheck → build → test → validate → ci`). Each
command branches off `setup`. Each command is a **Mastra workflow** built from
**Mastra tools that use no model** and wrap open-source libraries.

## State machines

Tested [XState](https://stately.ai/docs) machines in
[`src/machines/`](../src/machines/) model the CLI flows. Model-based tests in
[`tests/machines/`](../tests/machines/) walk each machine's paths against the
real code:

- [`cli-dispatch.ts`](../src/machines/cli-dispatch.ts): how argv leads to help,
  the version, an unknown-command error, or the command process from the
  dispatch table, and that process's exit code.
- [`command-lifecycle.ts`](../src/machines/command-lifecycle.ts): input
  validation, the workflow run, rendering, and the exit-code rule for
  partial failures.
- [`fetch.ts`](../src/machines/fetch.ts): the timeout for each attempt, bounded
  retry, same-host redirects, and each failure the fetch layer reports.
- [`scrape-fallback.ts`](../src/machines/scrape-fallback.ts): the fetch, then a
  browser render or a PDF read, or a refusal.
- [`jev-command.ts`](../src/machines/jev-command.ts): the `jev` command's
  argv parse, its correct and learn paths, and usage errors.
- [`mcp-serve.ts`](../src/machines/mcp-serve.ts): the stdio serve loop and how
  it answers a tool call.

## CLI guidelines

The CLI follows the [Command Line Interface Guidelines](https://clig.dev):

- Data goes to stdout. Logs go to stderr.
- `--json` works everywhere.
- `-o` writes to a file.
- Parsing is forgiving.
- `--help` is helpful.
- `doctor` checks your setup.

Return to the [README](../README.md) (navigation only).
