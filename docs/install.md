# Install channels

Pick one channel. This page lists every supported system, then the install script, then the other channels, then how to set your Jev key in each shell. For agent hosts, see the [plugin README](../plugins/webular/README.md).

## Platforms

Webular ships twelve native builds. Every install channel picks the one that fits your machine.

| System | CPU | libc | Build | Installs with | CI tests it |
|---|---|---|---|---|---|
| macOS | arm64 | n/a | `darwin-arm64` | npm, Bun, pnpm, `install.sh` | Yes (macOS arm) |
| macOS | x64 | n/a | `darwin-x64` | npm, Bun, pnpm, `install.sh` | Yes (macOS Intel) |
| macOS | x64, no AVX2 | n/a | `darwin-x64-baseline` | npm, Bun, pnpm, `install.sh` | No |
| Linux | x64 | glibc | `linux-x64` | npm, Bun, pnpm, `install.sh` | Yes (Ubuntu) |
| Linux | x64, no AVX2 | glibc | `linux-x64-baseline` | npm, Bun, pnpm, `install.sh` | No |
| Linux | arm64 | glibc | `linux-arm64` | npm, Bun, pnpm, `install.sh` | Yes (Ubuntu arm) |
| Linux | x64 | musl | `linux-x64-musl` | npm, Bun, pnpm, `install.sh` | Yes (Alpine container) |
| Linux | x64, no AVX2 | musl | `linux-x64-musl-baseline` | npm, Bun, pnpm, `install.sh` | No |
| Linux | arm64 | musl | `linux-arm64-musl` | npm, Bun, pnpm, `install.sh` | Release smoke test only (Alpine on Ubuntu arm) |
| Windows | x64 | n/a | `windows-x64` | npm, Bun, pnpm, `install.ps1` | Yes (Windows x64) |
| Windows | x64, no AVX2 | n/a | `windows-x64-baseline` | npm, Bun, pnpm, `install.ps1` | No |
| Windows | arm64 | n/a | `windows-arm64` | npm, Bun, pnpm, `install.ps1` | Yes (Windows arm) |

- **WSL** is Linux. Use the Linux commands inside it: npm, Bun, pnpm, or `install.sh`. WSL has no macOS Keychain, so set the key with an environment variable.
- **No AVX2.** Each x64 build has a `-baseline` sibling for CPUs without AVX2. The installers and the npm launcher pick it on their own when the CPU lacks AVX2. Set `WEBULAR_BASELINE=1` to force it.
- **Rosetta** on Apple silicon gets the native arm64 build.
- **Other systems** (32-bit, FreeBSD, and so on) have no build. Run from source as described in [Build and run](build-and-run.md).

### Features that work only on some systems

- **Jev key lookup.** Webular reads `TYPESAFE_API_KEY` first, on every system. Only when that is unset does it look in the macOS Keychain, in the item `typesafe-ai-api-key`. The Keychain step is macOS-only. On Linux and Windows, use the environment variable.
- **Cua browser mode** (`--render cua`, `act --goal`) is opt-in. It needs the separate `cua-driver` daemon and a throwaway browser window, as [Browser mode (Cua)](cua-browser-mode.md) explains. Webular's code knows the browser profile folders on macOS, Linux, and Windows, but treat Cua as macOS-first and confirm that `cua-driver` runs on your system before you rely on it.
- **Document conversion** (`parse` on Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and PDF files, and scrape's document route) uses the `@firecrawl/anydoc` addon. The addon ships no Windows arm64 binary. On Windows arm64, document conversion fails with the error code `unsupportedPlatform`. Everything else works there. To convert documents on that machine, run webular inside WSL, which uses the Linux arm64 build.
- **Everything else** (search, scrape, crawl, and the rest) is the same on every build.

## Install script

The install script is the primary way to install webular. `install.sh` covers macOS, Linux (glibc and musl), and WSL. `install.ps1` covers Windows. Each one picks the right build, checks its SHA-256, installs one binary, and puts it on your PATH. Neither needs root, and neither sends telemetry.

macOS and Linux:

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://webular.dev/install.ps1 | iex
```

Copy the command only from the [README](../README.md) or webular.dev, because fake install pages swap the host name. To pin a release, pass `--version <x.y.z>`.

Two checks guard the download, and they prove different things. `SHA256SUMS` proves the file is intact (integrity), but not who built it (origin). The attestation check proves origin. It is pinned to the signer workflow `srinitude/webular/.github/workflows/release.yml`. The checksums baked into the installer at release always win, and a `WEBULAR_BASE_URL` mirror never supplies its own. When `gh` is on your PATH, the installer runs the attestation check and stops if it fails. Without `gh`, it prints a note and goes on. `WEBULAR_VERIFY_ATTESTATION=1` makes `gh` required, and `0` skips the check. The [install script reference](install-script.md) covers reading the script before it runs, every option, where it installs, PATH changes, verification, proxies, and telemetry.

## npm, Bun, and pnpm

These work on every system in the table. The root `webular` package is a Node launcher. It installs only the native package for your OS, CPU, and libc, and it needs no download step after install.

```bash
npm i -g webular
pnpm add -g webular
bun add -g webular
```

Bun needs Node on your PATH too, because the launcher starts with a Node shebang.

### From GitHub Packages

Each release also goes to the GitHub Packages npm registry as `@srinitude/webular`. GitHub asks for a token to install from it, even for public packages: a personal access token (classic) with the `read:packages` scope. Add `@srinitude:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=TOKEN` to `~/.npmrc`, with your token in place of `TOKEN`. Then run `npm i -g @srinitude/webular`.

## Set your Jev key

Webular reads the key from `TYPESAFE_API_KEY`. Replace `...` with your key, and keep the key out of files you commit.

- **bash and zsh:** `export TYPESAFE_API_KEY=...` sets it for the current shell. Add the same line to `~/.bashrc` or `~/.zshrc` to keep it.
- **fish:** `set -Ux TYPESAFE_API_KEY ...`. The `-U` flag saves it for every fish session, and `-x` exports it to programs.
- **PowerShell:** `$env:TYPESAFE_API_KEY = "..."` sets it for the current session. `[Environment]::SetEnvironmentVariable("TYPESAFE_API_KEY", "...", "User")` saves it for your user account. New processes see the saved value, not windows that are already open.
- **cmd:** `setx TYPESAFE_API_KEY "..."`. The `setx` command changes only future command windows, so open a new one. To also use the key in the current window, run `set TYPESAFE_API_KEY=...`.

Syntax checked on 2026-10-21 against the [fish `set` page](https://fishshell.com/docs/current/cmds/set.html), the Microsoft Learn [`setx` page](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setx), and the Microsoft Learn [`Environment.SetEnvironmentVariable` page](https://learn.microsoft.com/en-us/dotnet/api/system.environment.setenvironmentvariable).

## MCP clients

`webular mcp` serves 24 MCP tools over stdio: one for each command but `mcp`, plus `machine.next` and four low-level `web.*` tools. Install webular first, so `webular` is on your PATH. The only key webular uses is the optional Jev key. The recommended way to reach Jev is the direct TypeSafe endpoint, with `TYPESAFE_API_KEY` or the macOS Keychain item `typesafe-ai-api-key`.

### Safety in agent mode

`webular mcp` and the plugin run in agent mode (`WEBULAR_AGENT_MODE=1`). Page text can steer an agent, so agent mode turns on two guards:

- Requests to your own network, such as `localhost` or `192.168.x.x`, are blocked. Set `WEBULAR_ALLOW_PRIVATE=1` in the server's `env` to allow them. The rules are in [Private addresses](commands.md#private-addresses).
- Files are written only inside the folder the server starts in, or `WEBULAR_OUTPUT_DIR`. Set `WEBULAR_SANDBOX=0` to allow any path. The rules are in [Output paths](commands.md#output-paths).

At the command line, neither guard is on, so you can scrape your own dev server and save files anywhere.

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

## More ways to install

mise, eget, the GitHub CLI, release files with manual checks, shell completions, upgrade, and uninstall are on the [more ways to install](install-more.md) page.

## Run from source instead

To run from source, use the bundles, or build the standalone executable, read [Build and run](build-and-run.md). Return to the [README](../README.md) (navigation only).
