# Use webular from your agent

One MCP server, one plugin, and four skills. Each runs the same commands.

## The MCP server

`webular mcp` runs on your machine over stdio. For the command or config block for your agent, see [Add webular to your agent](/install#agents).

## The plugin

The plugin's own server runs with Bun and has the 19 command tools. `webular mcp` has those 19 plus `machine.next` and four HTML tools, for 24. The plugin's server starts with `bun ./dist/server.js`.

## Skills

The four skills are `webular-research`, `webular-interview`, `human-language`, and `rich-and-native-markdown`.

## Results and paging

Each result holds at most 8,000 characters. A longer one comes back with a `cursor`.

## Safety in agent mode

Agent mode is on for `webular mcp` and the plugin. Page text can steer an agent, so agent mode turns on two guards. Set `WEBULAR_ALLOW_PRIVATE=1` or `WEBULAR_SANDBOX=0` to relax them.
