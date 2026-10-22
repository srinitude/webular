# More ways to install, verify, and upgrade

This page covers the channels beyond the [install script](install-script.md) and the packages on the [install channels page](install.md): mise, eget, and the release files themselves. It ends with completions, upgrade, and uninstall.

## mise

```bash
mise use -g github:srinitude/webular
```

Use the `github:` backend. Do not use `ubi:`.

## eget

On glibc Linux, skip the musl builds:

```bash
eget srinitude/webular --asset ^musl
```

On Alpine, take the musl build:

```bash
eget srinitude/webular --asset musl
```

## GitHub release binaries

These work on any build in the table. The install script does the same steps for you.

### Download and verify by hand

Download `webular-<build>` (`webular-<build>.exe` on Windows) from the [releases page](https://github.com/srinitude/webular/releases). Use the build name from the [Platforms table](install.md#platforms). Then verify it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
gh attestation verify webular-<build> --repo srinitude/webular
```

With the GitHub CLI, one command downloads the file and another checks it against the release:

```bash
gh release download --repo srinitude/webular --pattern 'webular-linux-x64'
gh release verify-asset webular-linux-x64 --repo srinitude/webular
```

## Shell completions

Run `webular completions <shell>` for bash, zsh, fish, or PowerShell, as the install script section shows. Each release also has `webular-completions.tar.gz`, with the same completions plus the `webular(1)` man page. Unpack it and copy each file to the folder your shell reads.

## Upgrade and uninstall

Upgrade with the channel you installed from. A copy from the install script upgrades itself:

```bash
webular upgrade
```

For the package channels:

```bash
npm i -g webular@latest     # or: bun add -g webular@latest, pnpm add -g webular@latest
```

Uninstall the same way: `sh install.sh --uninstall` for an install-script copy, or `npm rm -g webular`, `bun rm -g webular`, or `pnpm rm -g webular`. The install script PATH lines are described in [Upgrade and uninstall](install-script.md#upgrade-and-uninstall). The page cache is in `~/.cache/webular` unless `WEBULAR_CACHE_DIR` moves it.

Return to [Install channels](install.md) (navigation only).
