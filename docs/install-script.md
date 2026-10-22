# Install script

This page is the full reference for `install.sh` and `install.ps1`. The install script is the primary way to install webular. `install.sh` covers macOS, Linux (glibc and musl), and WSL. `install.ps1` covers Windows. Each one picks the right build for your machine, checks it against a SHA-256 hash, installs one binary, puts it on your PATH, and writes a receipt. Neither needs root, and neither sends telemetry.

macOS and Linux:

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://webular.dev/install.ps1 | iex
```

Each release attaches its own `install.sh` and `install.ps1`, with that release's version and every asset's SHA-256 baked in. The `webular.dev` addresses above serve the latest release. To pin a version, put it in the path: `https://webular.dev/v0.3.0/install.sh` and `https://webular.dev/v0.3.0/install.ps1`. The source is in [`scripts/install.sh`](../scripts/install.sh) and [`scripts/install.ps1`](../scripts/install.ps1).

## Stay safe

- Copy the install command only from the [README](../README.md) or webular.dev. Fake install pages swap the host name.
- Read the script before it runs. Download it, read it, then run it:

  ```bash
  curl --proto '=https' --tlsv1.2 -fsSLo install.sh https://webular.dev/install.sh
  less install.sh
  sh install.sh
  ```

- Check where the script came from. Every release attaches the script with provenance, so this works on the file you downloaded:

  ```bash
  gh attestation verify install.sh --repo srinitude/webular
  ```

## What the script does

1. Finds your OS, CPU, and libc, and maps them to one of the builds in the [Platforms table](install.md#platforms).
2. Downloads `webular-<build>` (`webular-<build>.exe` on Windows) from the release, or from `WEBULAR_BASE_URL` when you set it.
3. Checks the file's SHA-256 against the hash for its build. The hashes always come from GitHub or from the table baked into the script, even when `WEBULAR_BASE_URL` moves the download, so a mirror cannot vouch for itself.
4. Verifies the build's attestation when `gh` is installed and signed in. See [Verification](#verification).
5. Puts the binary in the install folder, with no `sudo`.
6. Adds that folder to your PATH, unless it is already there.
7. Writes a receipt that `webular upgrade` and `webular uninstall` read.

## Options

Set an environment variable on the `sh` side of the pipe:

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | WEBULAR_NO_MODIFY_PATH=1 sh
```

| Variable | What it does |
|---|---|
| `WEBULAR_VERSION` | The release to install, such as `0.3.0`. Without it, the script installs the version baked into it. |
| `WEBULAR_INSTALL` | The install prefix. The binary goes in `$WEBULAR_INSTALL/bin`. |
| `WEBULAR_BASE_URL` | The folder to download builds from. A `file://` folder works. Checksums still come from GitHub or the baked table. |
| `WEBULAR_VERIFY_ATTESTATION` | Unset: verify when `gh` is installed and signed in. `0`: skip the check. `1`: require it, and fail if it cannot run. |
| `WEBULAR_NO_MODIFY_PATH` | Set to `1` to leave your PATH and shell files alone. |
| `WEBULAR_ALLOW_ROOT` | Set to `1` to allow a run as root. |
| `WEBULAR_OS`, `WEBULAR_ARCH`, `WEBULAR_LIBC` | Override the detected system, CPU, and libc. |

`install.sh` also takes flags. Pass them after `sh -s --`:

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh -s -- --version 0.3.0 --no-modify-path
```

| Flag | What it does |
|---|---|
| `--version <v>` | Same as `WEBULAR_VERSION`. |
| `--no-modify-path` | Same as `WEBULAR_NO_MODIFY_PATH=1`. |
| `-y`, `--yes` | Answer yes to every question. |
| `--quiet` | Print only errors. |
| `--binary <path>` | Install a file you already have, with no download. See [Offline installs](#offline-installs). |

In PowerShell, set the same variables with `$env:NAME = 'value'` before the `irm` line. `WEBULAR_LIBC` does not apply on Windows.

## Where it installs

The script uses the first of these that applies:

1. `$WEBULAR_INSTALL/bin`, when `WEBULAR_INSTALL` is set.
2. `$XDG_BIN_HOME`.
3. `~/.local/bin`.

A copy at `~/.webular/bin/webular` is upgraded in place, so an existing install keeps its folder.

On Windows, the default is `%LOCALAPPDATA%\Programs\webular\bin`, unless `WEBULAR_INSTALL` is set.

The script never runs `sudo`. It refuses to run as root unless `WEBULAR_ALLOW_ROOT=1`.

## PATH

If the install folder is already on your PATH, the script changes nothing. Otherwise it:

- writes `~/.config/webular/env` and `~/.config/webular/env.fish`, which add the folder to your PATH.
- adds one guarded line that ends with `# webular` to each of these files: `~/.profile`, `~/.bashrc`, `${ZDOTDIR:-~}/.zshrc`, and `~/.config/fish/conf.d/webular.fish`.

`WEBULAR_NO_MODIFY_PATH=1` skips all of that. Other cases:

- In GitHub Actions, the script appends the folder to `$GITHUB_PATH`. Later steps see it.
- With `CI` set, the script skips the shell files.
- On Windows, the script adds the folder to the user `Path` under `HKCU\Environment`, stored as an expandable string. It then broadcasts a `WM_SETTINGCHANGE` message, so new windows see the change. Windows that are already open keep their old PATH.

## Receipt, upgrade, and uninstall

The script writes a receipt to `~/.config/webular/receipt.json`. On Windows it is `%LOCALAPPDATA%\webular\receipt.json`. `webular upgrade` and `webular uninstall` read it to find the install:

```bash
webular upgrade
webular uninstall
```

Running the install script again also upgrades the copy.

Shell completions come from the binary itself. Pick your shell: `bash`, `zsh`, `fish`, or `powershell`.

```bash
webular completions zsh
```

The release's `webular-completions.tar.gz` holds the same files, plus the `webular(1)` man page.

## Verification

Two checks guard the download, and they prove different things:

- **SHA-256 proves integrity.** The script compares the file with the hash for its build. A match shows the download is intact. It does not show who built the file. The hash comes from the release's `SHA256SUMS` on GitHub or from the table baked into the script, never from `WEBULAR_BASE_URL`.
- **Attestation proves origin.** The script runs `gh attestation verify` on the file. The check is pinned to the signer workflow `srinitude/webular/.github/workflows/release.yml`, so a build from any other workflow fails.

The script runs the attestation check by default when `gh` is installed and signed in, and it fails closed: a failed check stops the install. `WEBULAR_VERIFY_ATTESTATION=0` skips the check, and `1` makes it required even when `gh` is missing.

To check a build by hand, see [Download and verify by hand](install-more.md#download-and-verify-by-hand).

## Offline installs

To install without the network, use a binary you already have:

```bash
sh install.sh --binary ./webular-linux-x64
```

To serve builds from your own folder or server, set `WEBULAR_BASE_URL`. A `file://` folder works too. Its files need the same names as the release assets.

```bash
WEBULAR_BASE_URL=file:///srv/webular/0.3.0 WEBULAR_VERSION=0.3.0 sh install.sh
```

## Proxies

`curl` honors `HTTPS_PROXY` and the other standard proxy variables, so the script follows them. In PowerShell, `install.ps1` uses the proxy settings of your session.

```bash
HTTPS_PROXY=http://proxy.example:3128 sh install.sh
```

## CI

In CI, pin a version and set `GH_TOKEN`, so `gh attestation verify` can sign in. Set `WEBULAR_VERIFY_ATTESTATION=1` if the job should fail when the check cannot run.

```yaml
- name: Install webular
  run: curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/v0.3.0/install.sh | sh -s -- --yes --quiet
  env:
    GH_TOKEN: ${{ github.token }}
    WEBULAR_VERIFY_ATTESTATION: 1
```

In GitHub Actions, the script adds the install folder to `$GITHUB_PATH`, so later steps find `webular`. On other CI systems, `CI` makes the script skip the shell files, so put the folder on your `PATH` yourself.

## No telemetry

The scripts send nothing about you or your machine. Their only network calls are the downloads of the build and its checksums.

Other channels, the Jev key, and MCP clients are on the [install channels page](install.md).
