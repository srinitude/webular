# Agent contract

An AI agent uses webular through four surfaces: the `webular` CLI, the MCP server (stdio and HTTP), the agent plugin, and its skills. This page lists what an agent needs from them. The tests in [`tests/contract`](../tests/contract) check each item end to end.

## What an agent needs

1. **Find every command and its inputs.** `webular --help` and `webular <command> --help` list them. MCP `tools/list` gives each tool's input schema. The skills in [`plugins/webular/skills`](../plugins/webular/skills) name only real commands and flags.
2. **Send typed input and get typed JSON back.** `--json` prints JSON with a stable shape. MCP tools return the same data as structured content.
3. **Get clear errors it can act on.** Each error says what went wrong and what to do next. Exit codes stay fixed: 0 success, 1 failure, 2 wrong usage, 3 some batch items failed, 127 a tool is missing, and 128 + n when signal n stops the run. MCP returns an error result (`isError: true`) with the same text.
4. **Get output of a known size.** Long results come in pages, with a cursor for the next page.
5. **Get the same result for the same input.** Caches keep repeat calls stable.
6. **Start fast and set its own time limits.** Startup stays quick, and the agent can set a timeout per call.
7. **Use the CLI and MCP as one.** Each CLI command has one MCP tool, with the same name, inputs, outputs, and error text.
8. **Read plain descriptions.** Every command, tool, and flag description passes the readability lint.

## How the tests check it

- [`tests/contract/cli.test.ts`](../tests/contract/cli.test.ts): for each command in `COMMAND_NAMES`, it checks the help text, exit code 2 on wrong usage, the `--json` shape against a local fixture server, and the error wording.
- [`tests/contract/mcp.test.ts`](../tests/contract/mcp.test.ts): for each tool over stdio, it checks that the input schema matches the CLI flags, that results are structured, that bad input gets an error result, and that paging cursors match.
- [`tests/contract/skills.test.ts`](../tests/contract/skills.test.ts): it checks that skills name only real commands and flags, that every command has a skill or a stated reason, and that `plugin.json` and `mcp.json` point at real files.

When a test finds a gap, the fix goes in the surface, never in the test.
