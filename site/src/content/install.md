# Install webular

Run one command. It gets the build that matches your machine.

## One-line install

macOS and Linux:

```sh
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh
```

Downloads the webular build that matches your machine (OS, CPU, and libc), checks it against SHA256SUMS, and puts it in `~/.webular/bin`. [View the script](/install.sh).

Windows:

```powershell
irm https://webular.dev/install.ps1 | iex
```

Checks the download against SHA256SUMS and puts it in `$HOME\.webular\bin`. [View the script](/install.ps1).

If the script says to add `~/.webular/bin` to your PATH, do that. Then open a new terminal and run `webular doctor`.

## npm, Bun, and pnpm

These work on every supported system. They install only the native build for your OS, CPU, and libc.

```sh
npm i -g webular
bun add -g webular
pnpm add -g webular
```

Bun needs Node on your PATH too, because the launcher starts with a Node shebang.

## From source

```sh
git clone https://github.com/srinitude/webular.git
cd webular
bun install --frozen-lockfile
bun bin/webular.ts --help
```

<h2 id="agents">Add webular to your agent</h2>

Install webular first. The server runs on your machine over stdio: `webular mcp`.

- **Claude Code:** `claude mcp add webular -- webular mcp`. The plugin, with skills: `/plugin install webular --marketplace srinitude/webular`.
- **Codex CLI:** `codex mcp add webular -- webular mcp`, or put this in `~/.codex/config.toml`:

  ```toml
  [mcp_servers.webular]
  command = "webular"
  args = ["mcp"]
  ```

- **Cursor:** put this in `~/.cursor/mcp.json`:

  ```json
  { "mcpServers": { "webular": { "command": "webular", "args": ["mcp"] } } }
  ```

- **VS Code:** put this in `.vscode/mcp.json`:

  ```json
  { "servers": { "webular": { "type": "stdio", "command": "webular", "args": ["mcp"] } } }
  ```

- **Gemini CLI, Windsurf, Cline, and Claude Desktop:** put the same `mcpServers` block as Cursor's in that app's MCP config file.
- **Zed:** put this in its settings file, or go to Settings, then AI, then MCP Servers, then Add Server, then Add Local Server:

  ```json
  { "context_servers": { "webular": { "command": "webular", "args": ["mcp"] } } }
  ```

- **Skills only:** copy a folder from `plugins/webular/skills` into your agent's skills folder.

If the app says it cannot find `webular`, put the full path in `command`: your home folder plus `/.webular/bin/webular`, or `\.webular\bin\webular.exe` on Windows.

## Platforms

webular ships twelve native builds. Every install channel picks the one that fits your machine. Each x64 build has a `-baseline` sibling for x64 CPUs without AVX2.

| System | CPU | libc | Build |
|---|---|---|---|
| macOS | arm64 | n/a | `darwin-arm64` |
| macOS | x64 | n/a | `darwin-x64` |
| macOS | x64, no AVX2 | n/a | `darwin-x64-baseline` |
| Linux | x64 | glibc | `linux-x64` |
| Linux | x64, no AVX2 | glibc | `linux-x64-baseline` |
| Linux | arm64 | glibc | `linux-arm64` |
| Linux | x64 | musl | `linux-x64-musl` |
| Linux | x64, no AVX2 | musl | `linux-x64-musl-baseline` |
| Linux | arm64 | musl | `linux-arm64-musl` |
| Windows | x64 | n/a | `windows-x64` |
| Windows | x64, no AVX2 | n/a | `windows-x64-baseline` |
| Windows | arm64 | n/a | `windows-arm64` |

- **WSL** is Linux. Use the Linux commands inside it. WSL has no macOS Keychain, so set the key with an environment variable.
- **Rosetta** on Apple silicon gets the native arm64 build.
- **Other systems** (32-bit, FreeBSD, and so on) have no build. Run from source.

### Features that work only on some systems

- **Jev key lookup.** webular reads `TYPESAFE_API_KEY` first, on every system. Only when that is unset does it look in the macOS Keychain item `typesafe-ai-api-key`. The Keychain step is macOS-only.
- **Cua browser mode** (`--render cua`, `act --goal`) is opt-in. It needs the separate `cua-driver` daemon and a throwaway browser window. Treat it as macOS-first.
- **Document conversion** (`parse` on Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and PDF files) has no Windows arm64 binary. There it fails with the error code `unsupportedPlatform`. Run webular inside WSL to convert documents on that machine.
- **Everything else** (search, scrape, crawl, and the rest) is the same on every build.

## Verify a download

The install script checks the download against SHA256SUMS. To check by hand, download `webular-<build>` (`webular-<build>.exe` on Windows) from the [releases page](https://github.com/srinitude/webular/releases), then run:

```sh
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify webular-<build> --repo srinitude/webular
```

Set `WEBULAR_VERIFY_ATTESTATION=1` with `gh` installed to make the install script also check the build attestation.

## Shell completions

Each release has `webular-completions.tar.gz`, with completions for bash, zsh, fish, and PowerShell, plus the `webular(1)` man page. Unpack it and copy each file to the folder your shell reads.

## Upgrade

Run the install script again, or upgrade with your package manager:

```sh
npm i -g webular@latest
bun add -g webular@latest
pnpm add -g webular@latest
```

## Uninstall

- Install-script copy: delete `~/.webular`.
- npm: `npm rm -g webular`. Bun: `bun rm -g webular`. pnpm: `pnpm rm -g webular`.
- The page cache is in `~/.cache/webular`.
