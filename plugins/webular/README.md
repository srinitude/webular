# Webular plugin

This plugin gives an agent the webular tools over MCP. One server can serve every agent app, either as a child process or at a stable web address.

## Install

1. Install the tools once with `mise install`.
2. Run `mise run build` once, so each tool call starts a prebuilt command file.
3. Add the plugin folder `plugins/webular` to your agent app.
4. The app reads `mcp.json` and sees two servers: `webular` and `webular-http`.

## stdio or HTTP

- **stdio** (`webular`): the app starts `bun ./src/server.ts` itself. Nothing else to run. Use this by default.
- **HTTP** (`webular-http`): you run the server, and the app calls `https://webular-mcp.localhost/mcp`. Start it with `mise run plugin:dev`.

`mise run plugin:dev` uses portless. Portless gives the server a steady name instead of a random port. It serves HTTPS on port 443 by default, so the address has no port in it. Run `portless get webular-mcp` to print the address it is using.

On first run portless makes a local certificate and asks you to trust it. On macOS and Linux it may ask for your password to bind port 443.

## Known issues

These are open portless issues. They are not bugs in this plugin.

- **Windows, #222:** portless opens and closes terminal windows over and over while it runs.
- **Windows, #305:** `portless run` fails with "is not recognized" when your PATH is longer than 8191 characters.
- **Windows, #391:** LAN mode does not start, because it needs mDNS publishing that Windows does not have.
- **Linux, #267:** trusting the certificate can fail on Arch (`update-ca-trust` cannot write its bundle), so the browser says the certificate is not valid.

If portless gives you trouble, use the stdio server. It does not need portless.

## Done when

- [ ] `mise install` finished with no errors.
- [ ] The `webular` stdio server starts in your agent app.
- [ ] `mise run plugin:dev` starts the HTTP server.
- [ ] `portless get webular-mcp` prints the address `https://webular-mcp.localhost`.
- [ ] The app can call `https://webular-mcp.localhost/mcp` without a certificate warning.
