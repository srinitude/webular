# Install channels

Pick one channel. This page lists every supported system, then the commands for each channel, then how to set your Jev key in each shell. For agent hosts, see the [plugin README](../plugins/webular/README.md).

## Platforms

Webular ships eight native builds. Every install channel picks the one that fits your machine.

| System | CPU | libc | Build | Installs with | CI tests it |
|---|---|---|---|---|---|
| macOS | arm64 | n/a | `darwin-arm64` | npm, Bun, pnpm, Homebrew, `install.sh` | Yes (macOS arm) |
| macOS | x64 | n/a | `darwin-x64` | npm, Bun, pnpm, Homebrew, `install.sh` | Yes (macOS Intel) |
| Linux | x64 | glibc | `linux-x64` | npm, Bun, pnpm, Homebrew, `install.sh` | Yes (Ubuntu) |
| Linux | arm64 | glibc | `linux-arm64` | npm, Bun, pnpm, Homebrew, `install.sh` | Yes (Ubuntu arm) |
| Linux | x64 | musl | `linux-x64-musl` | npm, Bun, pnpm, `install.sh` | Yes (Alpine container) |
| Linux | arm64 | musl | `linux-arm64-musl` | npm, Bun, pnpm, `install.sh` | Release smoke test only (Alpine on Ubuntu arm) |
| Windows | x64 | n/a | `windows-x64` | npm, Bun, pnpm, Scoop, winget, `install.ps1` | Yes (Windows x64) |
| Windows | arm64 | n/a | `windows-arm64` | npm, Bun, pnpm, Scoop, winget, `install.ps1` | Yes (Windows arm) |

- **WSL** is Linux. Use the Linux commands inside it: npm, Bun, pnpm, or `install.sh`. WSL has no macOS Keychain, so set the key with an environment variable.
- **Rosetta** on Apple silicon gets the native arm64 build. **musl** (Alpine) has no Homebrew build, so use npm or `install.sh`.
- **Other systems** (32-bit, FreeBSD, and so on) have no build. Run from source as described in [Build and run](build-and-run.md).

### Features that work only on some systems

- **Jev key lookup.** Webular reads `TYPESAFE_API_KEY` first, on every system. Only when that is unset does it look in the macOS Keychain, in the item `typesafe-ai-api-key`. The Keychain step is macOS-only. On Linux and Windows, use the environment variable.
- **Cua browser mode** (`--render cua`, `act --goal`) is opt-in. It needs the separate `cua-driver` daemon and a throwaway browser window, as [Browser mode (Cua)](cua-browser-mode.md) explains. Webular's code knows the browser profile folders on macOS, Linux, and Windows, but treat Cua as macOS-first and confirm that `cua-driver` runs on your system before you rely on it.
- **Everything else** (search, scrape, crawl, and the rest) is the same on every build.

## npm, Bun, and pnpm

These work on every system in the table. The root `webular` package is a Node launcher. It installs only the native package for your OS, CPU, and libc, and it needs no download step after install.

```bash
npm i -g webular
pnpm add -g webular
bun add -g webular
```

Bun needs Node on your PATH too, because the launcher starts with a Node shebang.

## Homebrew

Homebrew works on macOS and glibc Linux, including WSL with a glibc distro.

```bash
brew install srinitude/webular/webular
```

## Scoop

Scoop works on Windows, x64 and arm64.

```powershell
scoop bucket add webular https://github.com/srinitude/scoop-webular
scoop install webular
```

## winget

winget works on Windows once the manifest pull request to `microsoft/winget-pkgs` merges.

```powershell
winget install Srinitude.Webular
```

## GitHub release binaries

These work on any build in the table.

### Install scripts

On macOS and Linux, including musl and WSL, [`scripts/install.sh`](../scripts/install.sh) picks the right asset, checks it against `SHA256SUMS`, and installs it to `~/.webular/bin/webular`. It prints a line when that folder is not on your PATH.

```bash
curl -fsSL https://github.com/srinitude/webular/releases/latest/download/install.sh | sh
```

On Windows, [`scripts/install.ps1`](../scripts/install.ps1) does the same in PowerShell and installs to `~\.webular\bin\webular.exe`:

```powershell
irm https://github.com/srinitude/webular/releases/latest/download/install.ps1 | iex
```

### Download and verify

Download `webular-<build>` (`webular-<build>.exe` on Windows) from the [releases page](https://github.com/srinitude/webular/releases). Use the build name from the Platforms table. Then verify it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify webular-<build> --repo srinitude/webular
```

## Set your Jev key

Webular reads the key from `TYPESAFE_API_KEY`. Replace `...` with your key, and keep the key out of files you commit.

- **bash and zsh:** `export TYPESAFE_API_KEY=...` sets it for the current shell. Add the same line to `~/.bashrc` or `~/.zshrc` to keep it.
- **fish:** `set -Ux TYPESAFE_API_KEY ...`. The `-U` flag saves it for every fish session, and `-x` exports it to programs.
- **PowerShell:** `$env:TYPESAFE_API_KEY = "..."` sets it for the current session. `[Environment]::SetEnvironmentVariable("TYPESAFE_API_KEY", "...", "User")` saves it for your user account. New processes see the saved value, not windows that are already open.
- **cmd:** `setx TYPESAFE_API_KEY "..."`. The `setx` command changes only future command windows, so open a new one. To also use the key in the current window, run `set TYPESAFE_API_KEY=...`.

Syntax checked on 2026-10-21 against the [fish `set` page](https://fishshell.com/docs/current/cmds/set.html), the Microsoft Learn [`setx` page](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setx), and the Microsoft Learn [`Environment.SetEnvironmentVariable` page](https://learn.microsoft.com/en-us/dotnet/api/system.environment.setenvironmentvariable).

## MCP clients

`webular mcp` serves 24 MCP tools over stdio: one for each command but `mcp`, plus `machine.next` and four low-level `web.*` tools. Install webular first, so `webular` is on your PATH. The only key webular uses is the optional Jev key. The recommended way to reach Jev is the direct TypeSafe endpoint, with `TYPESAFE_API_KEY` or the macOS Keychain item `typesafe-ai-api-key`.

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

To run from source, use the bundles, or build the standalone executable, read [Build and run](build-and-run.md). Return to the [README](../README.md) (navigation only).
