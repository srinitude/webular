# Build and run

Read this page to run webular from source, to use the minified bundles, or to
build the standalone executable.

## Run from source

To run from source, you need [Bun](https://bun.com).

### Dispatch table

The `run:<command>` tasks in `mise.toml` define every subcommand.
`mise run build` turns them into a committed table,
`src/cli/dispatch-table.ts`. The CLI reads that table and starts the command
itself, so no mise process runs per command. A test fails when the table and
`mise.toml` disagree.

### mise

[mise](https://mise.jdx.dev) comes as
a pinned npm dependency for the build, `doctor`, and `tasks`. If mise is on
your PATH, webular uses that copy.

## Bundles

Commands run from minified bundles in `dist/commands`. A bundle starts with
about half the CPU that the TypeScript source needs. `mise run build` makes the
bundles. To run straight from `src/` while you edit, set `WEBULAR_DEV=1`.
Then you need no build step. When a bundle is missing, the CLI runs that
command from `src/`.

## Standalone executable

`mise run build` also compiles a native `dist/bin/webular` (`webular.exe` on
Windows).

### Build targets

`mise run compile:all` builds one for every Bun target: macOS arm64
and x64, Linux x64 and arm64 with glibc or musl, and Windows x64 and arm64.

### Where it runs

The executable starts faster and uses less CPU than `bun bin/webular.ts`. It
runs each command with itself as the Bun runtime, so you need no separate Bun.
It finds its commands by walking up from its own folder to `mise.toml`. Keep
it in the package folder, below `mise.toml` and `dist/commands`. The default
path is `dist/bin/webular`.

Return to the [README](../README.md) (navigation only).
