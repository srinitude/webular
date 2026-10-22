# Webular plugin

This plugin gives an agent the webular tools over MCP. The plugin folder runs on its own: copy just [`plugins/webular`](.) into your agent app, and its server calls the `webular` command for each tool.

## Install

1. Install webular, so the `webular` command is on your PATH. To use another copy, set `WEBULAR_BIN` to its path.
2. Add the plugin folder [`plugins/webular`](.) to your agent host, the way your host adds plugins or MCP servers. The folder carries a manifest for each host that needs its own file.
3. The host reads [`mcp.json`](mcp.json), or a host-specific copy such as [`.mcp.json`](.mcp.json), and starts one server: `webular`.

## Output size

Each tool result holds at most 8,000 characters. A longer result comes back cut, with a `cursor`. To get the next part, call the same tool again with the same input and that `cursor`.

## stdio or HTTP

- **stdio** (`webular`): the app starts `bun ./dist/server.js` itself, with nothing else to run. This is the only server the plugin ships.
- **HTTP**, for local development only: you run the server, and your app calls `https://webular-mcp.localhost/mcp`. Start it from a checkout with `mise run plugin:dev`. This address works only on your own machine, so no shipped manifest names it.

`mise run plugin:dev` uses portless. Portless gives the server a steady name instead of a random port. It serves HTTPS on port 443 by default, so the address has no port in it. Run `portless get webular-mcp` to print the address it is using.

On first run, portless makes a local certificate and asks you to trust it. On macOS and Linux it may ask for your password to bind port 443.

## Known issues

These are open portless issues. They are not bugs in this plugin.

- **Windows, #222:** portless opens and closes terminal windows over and over while it runs.
- **Windows, #305:** `portless run` fails with "is not recognized" when your PATH is longer than 8191 characters.
- **Windows, #391:** LAN mode does not start, because it needs mDNS publishing that Windows does not have.
- **Linux, #267:** trusting the certificate can fail on Arch (`update-ca-trust` cannot write its bundle), so the browser says the certificate is not valid.

If portless gives you trouble, use the stdio server. It does not need portless.

## Done when

- [ ] `webular --version` prints a version.
- [ ] The `webular` stdio server starts in your agent app.
- [ ] A long result comes back with a `cursor`, and the next call with it returns the rest.
- [ ] For local development, `mise run plugin:dev` starts the HTTP server at `https://webular-mcp.localhost/mcp`.
