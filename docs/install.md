# Install channels

Pick one channel. The npm channel is in the README's Install section. Use the
other channels here when npm does not fit.

## Bun

Bun needs Node on your PATH, because the launcher starts with a Node shebang.

```bash
bun add -g webular
```

## Homebrew

Homebrew works on macOS and glibc Linux.

```bash
brew install srinitude/webular/webular
```

## Scoop

Scoop works on Windows.

```powershell
scoop bucket add webular https://github.com/srinitude/scoop-webular
scoop install webular
```

## winget

winget works on Windows. It works once the manifest pull request to
`microsoft/winget-pkgs` has merged.

```powershell
winget install Srinitude.Webular
```

## GitHub release binaries

These work on any platform.

### Download and verify

Download `webular-<platform>` (`webular-<platform>.exe` on Windows) from the
[releases page](https://github.com/srinitude/webular/releases). Then verify it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify webular-<platform> --repo srinitude/webular
```

### Platforms

The platforms are `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`,
`linux-x64-musl`, `linux-arm64-musl`, `windows-x64`, and `windows-arm64`.

### Install scripts

On macOS and Linux, including musl, [`scripts/install.sh`](../scripts/install.sh) picks the right
asset, checks it against `SHA256SUMS`, and installs it to
`~/.webular/bin/webular`:

```bash
curl -fsSL https://github.com/srinitude/webular/releases/latest/download/install.sh | sh
```

On Windows, [`scripts/install.ps1`](../scripts/install.ps1) does the same in PowerShell and installs
to `~\.webular\bin\webular.exe`:

```powershell
irm https://github.com/srinitude/webular/releases/latest/download/install.ps1 | iex
```

## MCP clients

`webular mcp` serves every command as an MCP tool over stdio. Install webular first, so `webular` is on your PATH. The only key webular uses is the optional Jev key. The recommended way to reach Jev is the direct TypeSafe endpoint, with `TYPESAFE_API_KEY` or the macOS Keychain item `typesafe-ai-api-key`.

### Claude Code

```bash
claude mcp add webular -- webular mcp
```

To get the skills too, install the plugin instead:

```text
/plugin install webular --marketplace srinitude/webular
```

The plugin's own manifest runs `bun ./dist/server.js` from the plugin folder. The [plugin README](../plugins/webular/README.md) covers that server, its HTTP mode, and `WEBULAR_BIN`.

### Codex CLI

```bash
codex mcp add webular -- webular mcp
```

To edit the file instead, put this in `~/.codex/config.toml`, or in `.codex/config.toml` for a trusted project.

```toml
[mcp_servers.webular]
command = "webular"
args = ["mcp"]
```

### VS Code and GitHub Copilot

Put this in `.vscode/mcp.json`. VS Code uses the `servers` key.

```json
{ "servers": { "webular": { "type": "stdio", "command": "webular", "args": ["mcp"] } } }
```

### Claude Desktop, Cursor, Windsurf, Cline, and Gemini CLI

Each of these reads an `mcpServers` block. Put it in that app's MCP config file.

```json
{ "mcpServers": { "webular": { "command": "webular", "args": ["mcp"] } } }
```

### Zed

Zed uses the `context_servers` key in its settings file. You can also add the server in the UI: open Settings, then AI, then MCP Servers, then Add Server, then Add Local Server.

```json
{ "context_servers": { "webular": { "command": "webular", "args": ["mcp"] } } }
```

### Skills without the plugin

Copy a folder from [`plugins/webular/skills`](../plugins/webular/skills) into your agent's skills folder. The skills are `webular-research`, `webular-interview`, `human-language`, and `rich-and-native-markdown`.

## Shell completions

Each release has `webular-completions.tar.gz`, with completions for bash, zsh, fish, and PowerShell, plus the `webular(1)` man page. Unpack it and copy each file to the folder your shell reads.

## Upgrade and uninstall

Upgrade with the channel you installed from:

```bash
npm i -g webular@latest     # or: bun add -g webular@latest, pnpm add -g webular@latest
brew upgrade webular
```

On Windows, run `scoop update webular` or `winget upgrade Srinitude.Webular`. To upgrade an install-script copy, run its script again.

Uninstall the same way: `npm rm -g webular`, `bun rm -g webular`, `pnpm rm -g webular`, `brew uninstall webular`, `scoop uninstall webular`, or `winget uninstall Srinitude.Webular`. An install-script copy lives in `~/.webular`, so delete that folder. The page cache is in `~/.cache/webular` unless `WEBULAR_CACHE_DIR` moves it.

## Run from source instead

To run from source, use the bundles, or build the standalone executable, read
[Build and run](build-and-run.md). Return to the [README](../README.md)
(navigation only).
