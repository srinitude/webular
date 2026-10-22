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

## Run from source instead

To run from source, use the bundles, or build the standalone executable, read
[Build and run](build-and-run.md). Return to the [README](../README.md)
(navigation only).
