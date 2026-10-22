# plugins/AGENTS.md

This folder holds the agent plugins of the repo. The repo-wide rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [`plugins/webular`](webular) is the one plugin. It has its own manifests, MCP server, skills, evals, and tests.

## Checks

- `mise run plugin:ci` runs every plugin check, from lint to the bundle.

## Children

- [plugins/webular/AGENTS.md](webular/AGENTS.md): the rules for the webular plugin.
