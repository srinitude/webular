# Use webular from your agent

webular reaches your agent as one MCP server, one plugin, and four skills. Each runs the same commands. To connect a host, see [Install](/install#agents).

## Plugin

The plugin bundles the MCP server and the skills. Install it from the `srinitude/webular` marketplace. The plugin's server has 19 command tools; `webular mcp` has [24 tools](/tools).

## Results and paging

Each result holds at most 8,000 characters. A longer one comes back with a `cursor` for the next part. Pass the cursor to the same tool to read on. Errors say what went wrong and what to do next, and the exit codes stay fixed.

## Safety in agent mode

`webular mcp` and the plugin run in agent mode, because page text can steer an agent. Agent mode turns on two guards:

- Requests to your own network, such as `localhost` or `192.168.x.x`, are blocked. Set `WEBULAR_ALLOW_PRIVATE=1` to allow them.
- Files are written only inside the folder the server starts in, or `WEBULAR_OUTPUT_DIR`. Set `WEBULAR_SANDBOX=0` to allow any path.

At the command line, neither guard is on.

## Skills

- `webular-research`: searches the web, reads a page as Markdown, lists a site's pages, and pulls key sentences.
- `webular-interview`: asks one question at a time to settle what a piece of work is for before it starts.
- `human-language`: writes plain prose at about grade 6.
- `rich-and-native-markdown`: turns text into clear Markdown and keeps its meaning.

To use the skills without the plugin, copy a folder from `plugins/webular/skills` into your agent's skills folder.
