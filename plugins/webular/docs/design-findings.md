# Webular plugin: design findings

These findings come from by-design, design-like-im-5, and design-audit (in-context mode), run on the plugin's MCP tools, skills, and help and error text. Each item gives the decision, the finding or pass, the fix, and whether the fix is in the plugin.

Three lenses apply:

- **by-design:** is each choice made on purpose, or inherited?
- **design-like-im-5:** vetoes in this order: safety, access, understanding, agency, task success, convention.
- **design-audit:** the frozen reviewer prompt. Its eight visual ratings read "Can't tell" on a surface with no screens. Its Straightforward rule (an error says what went wrong and what to do next) and its Consistent rule (same job, same name) carry the review.

## Tool naming

1. **Bare names vs a `webular_` prefix.** Pass. Hosts already scope tools by server, so a prefix would double up. Bare names are kept on purpose.
2. **Tool name equals the CLI command name.** Finding: names like `media`, `feed`, `batch`, `monitor`, `parse`, and `act` are not verbs an agent can guess. Decision: tool names stay equal to CLI command names, so the CLI help, the docs, and the MCP list share one set of words. Each description carries the verb instead. Open: verb names such as `download_media` and `read_feed`, with a separate `command` field.
3. **Two servers in `mcp.json`.** Finding: a host that loads both `webular` and `webular-http` lists each tool twice. Open: ship only the stdio entry, and document HTTP as a block to paste in.

## Shared input fields

4. **`url`.** Fixed: one shared URL schema for every tool that takes a URL. It allows only `http` and `https`.
5. **`query` vs `topic`, `limit` vs `sources`.** Finding: `research` takes `topic` and `answer` takes `sources`, while other tools use `query` and `limit`. Open: expose `query` and `limit`, and map them to the CLI flags in the adapter.
6. **List inputs.** Fixed: `batch` takes `urls` as an array, joined into the CLI form only inside the adapter.
7. **File paths and side effects (safety veto).** Finding: `media -o`, `parse --file`, and `monitor --db` let a caller read or write any path. Fixed for `monitor`: the server does not expose `--db`. Open: `media` writes to a folder the server picks.
8. **Count field descriptions.** Fixed: every `limit` description ends with its default and range.
9. **Fallback switches.** Fixed: `scrape` and `feed` share one `archive` description, and the optional output fields (`archivedFrom`, `feedUrl`, `source`) are named in each tool's output schema, so an agent knows to look for them.

## Error text

10. **Who gets blamed for a failure.** Finding: "Fix the input and call the tool again" is wrong when the site is down. Fixed, by exit code:
    - Exit 2: "webular {name} failed: {why}. Fix the input and call it again."
    - Any other exit: "webular {name} failed: {why}. The input looked valid. Try another URL, or tell the user the site could not be read."
11. **Output that is not JSON.** Fixed: "webular {name} returned output that is not JSON. This is a webular bug. Do not retry. Tell the user, and include the tool name."
12. **Could not start.** Fixed: "webular {name} could not start: {why}. Check that Bun is installed and the plugin folder is intact, then restart the MCP server."
13. **The output cap.** Fixed: a cut result carries `truncated: true` and a `next` hint: "Output was cut at {cap} characters. Call {name} with a smaller limit, or scrape one URL at a time."

## Description template

14. **Template wording.** Finding: no description said when not to use the tool. Open: one template for every tool: "{Does what}. Use when {trigger}. For {neighbor case}, use {other tool}. Returns {shape}."
15. **Server description.** Fixed: "Web research tools for agents: search, read, crawl, extract, and watch web pages, with typed inputs and capped output. No API key needed."

## Skill structure

16. **webular-research against the spec.** Pass: the name matches the folder, it uses allowed keys only, the body is short, and references sit one level deep.
17. **What the skill covers.** Finding: "Pick the tool" listed 4 of 14 tools. Fixed: a goal-first table with one row per tool.
18. **webular-interview (agency veto).** Finding: six questions before a one-line lookup cost more than the lookup. Fixed: "Ask only the questions the request leaves open. Skip any it already answers. Ask none for a single lookup with a clear URL or query." The description says it is not for a single search or a single URL.
19. **Spec rules.** Sources: agentskills.io/specification and `skills-ref/src/skills_ref/validator.py` in github.com/agentskills/agentskills. Allowed keys are `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. `metadata` values are strings, and the folder name equals `name`. The plugin tests check each rule.
