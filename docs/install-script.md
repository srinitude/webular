# Install script

This page is the full reference for `install.sh` and `install.ps1`, the primary way to install webular. `install.sh` covers macOS, Linux (glibc and musl), and WSL. `install.ps1` covers Windows. Each one picks the right build for your machine, checks its SHA-256 hash, runs it once, installs one binary, and puts it on your PATH. Neither needs root, and neither sends telemetry.

macOS and Linux:

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://webular.dev/install.ps1 | iex
```

Each release attaches its own `install.sh` and `install.ps1`, with that release's version and every asset's SHA-256 baked in. The source is in [`scripts/install.sh`](../scripts/install.sh) and [`scripts/install.ps1`](../scripts/install.ps1).

## Stay safe

- Copy the install command only from the [README](../README.md) or webular.dev. Fake install pages swap the host name.
- Read the script before it runs. Download it, read it, then run it:

  ```bash
  curl --proto '=https' --tlsv1.2 -fsSLo install.sh https://webular.dev/install.sh
  less install.sh
  sh install.sh
  ```

- The whole script sits inside one `main` function that runs on its last line, so a download cut off midway runs nothing.

## What the script does

1. Finds your OS, CPU, libc, and AVX2 support, and maps them to one build in the [Platforms table](install.md#platforms). A Mac shell under Rosetta gets the arm64 build. An x64 CPU without AVX2 gets the `-baseline` build. On Linux it checks for glibc first, so a glibc system that also has the musl loader still gets the glibc build.
2. Downloads `webular-<build>` (`webular-<build>.exe` on Windows) over HTTPS with TLS 1.2 at least, with three retries.
3. Checks the file's SHA-256 against the hash for its build. The hashes baked into the script at release always win. A copy without them reads `SHA256SUMS` from the GitHub release, never from a `WEBULAR_BASE_URL` mirror. A mismatch, a missing hash, or no SHA-256 tool stops the install.
4. Runs `gh attestation verify` when `gh` is on your PATH, and stops if it fails. Without `gh`, it prints a one-line note and goes on.
5. Runs `webular --version` on the new file before it replaces anything. A build that cannot run here is never installed.
6. Moves the binary into the install folder in one step, so a running copy is never half-written.
7. Adds that folder to your PATH, once.
8. Warns when another `webular` comes first on your PATH.

## Options

| Flag | Variable | What it does |
|---|---|---|
| `--version <x.y.z>` | `WEBULAR_VERSION` | Install that release instead of the latest. A leading `v` is fine. |
| `--no-modify-path` | `WEBULAR_NO_MODIFY_PATH=1` | Leave your shell files alone. |
| `--uninstall` | `WEBULAR_UNINSTALL=1` | Remove the binary and the PATH lines the script added. |
| `--quiet` | `WEBULAR_QUIET=1` | Print only errors. |
| | `WEBULAR_INSTALL` | The install root. The binary goes in `$WEBULAR_INSTALL/bin`. |
| | `WEBULAR_BASE_URL` | The folder the build downloads from: `https://`, `file://`, or `http://` on loopback only. It serves only the build; its own `SHA256SUMS` is never used. |
| | `WEBULAR_BASELINE` | `1` forces the no-AVX2 x64 build, `0` skips it. |
| | `WEBULAR_VERIFY_ATTESTATION=1` or `0` | `1` makes `gh` required, so a missing `gh` stops the install. `0` skips the attestation check. |
| | `WEBULAR_ALLOW_SUDO=1` | Allow a run under `sudo`. |
| | `WEBULAR_OS`, `WEBULAR_ARCH`, `WEBULAR_LIBC` | Override detection (`install.sh` only). |

Pass flags after `sh -s --`:

```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh -s -- --version <x.y.z> --no-modify-path
```

In PowerShell, set the variables with `$env:NAME = 'value'` before the `irm` line.

## Where it installs

The binary goes in `$WEBULAR_INSTALL/bin`, or `~/.webular/bin` when that is unset. On Windows it is `$env:WEBULAR_INSTALL\bin`, or `~\.webular\bin`. The script refuses to run under `sudo` unless `WEBULAR_ALLOW_SUDO=1`.

## PATH

`install.sh` adds one line that ends with `# webular` to the startup file of your shell: `~/.zshrc` for zsh, `~/.bashrc` for bash (plus `~/.bash_profile` on macOS), `~/.config/fish/conf.d/webular.fish` for fish, and `~/.profile` otherwise. A second run adds nothing. In GitHub Actions it also appends the folder to `$GITHUB_PATH`.

`install.ps1` adds the folder to the user `Path` under `HKCU\Environment` and broadcasts the change, so new windows see it.

## Upgrade and uninstall

Run the install command again to upgrade, or run `webular upgrade`, which prints the right command for your install. To remove webular, run the script with `--uninstall` (or `WEBULAR_UNINSTALL=1` for `install.ps1`). Shell completions come from the binary: `webular completions zsh`.

## Verification

- **SHA-256 proves integrity.** A match shows the download is intact. It does not show who built it.
- **Attestation proves origin.** When `gh` is on your PATH, the script runs `gh attestation verify`, pinned to the signer workflow `srinitude/webular/.github/workflows/release.yml`, and stops if it fails. Without `gh`, it prints a note and goes on. `WEBULAR_VERIFY_ATTESTATION=1` makes `gh` required, and `WEBULAR_VERIFY_ATTESTATION=0` skips the check.

To check a build by hand, see [Download and verify by hand](install-more.md#download-and-verify-by-hand).

## Proxies

`curl` and `wget` honor `HTTPS_PROXY` and `NO_PROXY`. `install.ps1` passes `HTTPS_PROXY` to its downloads.

## No telemetry

The scripts send nothing about you or your machine. Their only network calls are the downloads of the build and its checksums.

Other channels, the Jev key, and MCP clients are on the [install channels page](install.md).
