# Keys

webular needs no key. Jev, TypeSafe's decision model, is the one optional key.

## No key

Every command runs with no key. Each Jev decision falls back to a built-in baseline. `WEBULAR_JEV=off` turns Jev off.

## A Jev key

Jev is TypeSafe's System One decision model. It makes the judgment calls sharper. Set `TYPESAFE_API_KEY`, from TypeSafe or another provider of Jev. Replace `...` below with your key, and keep the key out of files you commit.

## macOS Keychain

When `TYPESAFE_API_KEY` is unset, webular on macOS also reads the Keychain item `typesafe-ai-api-key`.

```sh
security add-generic-password -a "$USER" -s typesafe-ai-api-key -w
```

## bash and zsh

This shell only:

```sh
read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY
```

To keep it, add `export TYPESAFE_API_KEY=...` to `~/.bashrc` or `~/.zshrc`.

## fish

```fish
set -Ux TYPESAFE_API_KEY ...
```

The `-U` flag saves it for every fish session, and `-x` exports it to programs.

## PowerShell

For the current session:

```powershell
$env:TYPESAFE_API_KEY = "..."
```

To save it for your user account:

```powershell
[Environment]::SetEnvironmentVariable("TYPESAFE_API_KEY", "...", "User")
```

New processes see the saved value, not windows that are already open.

## cmd

```bat
setx TYPESAFE_API_KEY "..."
```

The `setx` command changes only future command windows, so open a new one. To also use the key in the current window, run `set TYPESAFE_API_KEY=...`.

## WSL

WSL is Linux. Use the bash or zsh steps inside it. WSL has no macOS Keychain, so set the key with an environment variable.
