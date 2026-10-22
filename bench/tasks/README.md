# Benchmark tasks

The `private/` folder holds the 30% private split. Git ignores it. To keep a safe copy, store it encrypted outside the repo. The passphrase lives in a macOS Keychain item, which the script reads with the macOS `security` tool, so run it on macOS.

Set licenses are in [LICENSES.md](LICENSES.md). Sources and known limits of the tasks built here are in [SOURCES.md](SOURCES.md).

## Set the passphrase once

```sh
security add-generic-password -s webular-bench-private -a "$USER" -w
```

The command asks you for the passphrase. If the Keychain item is missing, the script stops and prints this command.

## Encrypt

```sh
bash scripts/bench/tasks/private-crypt.sh encrypt
```

This writes `$HOME/.local/share/webular-bench/private.tar.enc`. Add a path to use another file.

## Decrypt

```sh
bash scripts/bench/tasks/private-crypt.sh decrypt
```

This restores `bench/tasks/private`. It stops if that folder already has files, so it never overwrites your work. Add a path to read another archive.
