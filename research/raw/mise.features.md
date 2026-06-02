# mise-en-place — Web-Tooling Primitive Features for webular

> Deep-read: 30 pages out of 225 total URLs.
> Focus: task orchestration, dependency graphs, file-watching, environment management, template engine, hooks, CLI codegen — the **build primitives** webular will wire together.

---

## URL Inventory Categorization (225 total URLs)

| Bucket | Count | Example paths |
|---|---|---|
| Task execution / orchestration | 22 | /tasks, /tasks/toml-tasks, /tasks/running-tasks, /cli/tasks/*, /cli/run, /cli/watch |
| Configuration / environments | 18 | /configuration, /configuration/settings, /configuration/environments, /environments, /environments/secrets/*, /cli/env, /cli/set |
| Templates & code generation | 8 | /templates, /tasks/templates, /cli/generate/task-docs, /cli/generate/task-stubs, /cli/generate/*, /hooks |
| Dev-tools / backends / plugins | 60+ | /dev-tools, /dev-tools/backends/*, /plugins, /lang/*, /core-tools |
| CLI reference | 80+ | /cli/*, /cli/tasks/*, /cli/settings/*, /cli/plugins/*, /cli/sync/*, /cli/generate/* |
| Architecture / concepts | 10 | /architecture, /tasks/architecture, /sandboxing, /cache-behavior, /paranoid |
| Monorepo | 4 | /tasks/monorepo, /tasks/task-configuration (monorepo section) |
| Secrets | 3 | /environments/secrets, /environments/secrets/age, /environments/secrets/sops |
| Cookbook / how-tos | 12 | /mise-cookbook/*, /tips-and-tricks, /getting-started |
| Other (meta, registry, install) | ~8 | /README, /about, /registry, /installing-mise, /mcp |

---

## Feature Catalog

---

### 1. TOML Task Definition

**Category:** task/orchestration

**Purpose:** Define tasks inline in `mise.toml` under `[tasks.*]`. Each task is a named unit of work with a run script, description, dependencies, environment, sources/outputs, shell override, and more. The entry point for webular's pipeline step definitions.

**Key parameters:**
- `run`: `string | string[] | { task, args, env }[]` — command(s) to execute
- `run_windows`: Windows-specific run variant
- `depends`: prerequisite tasks (run before)
- `depends_post`: cleanup tasks (run after)
- `wait_for`: optional soft dependencies (wait if already running)
- `env`: `{ key: string | int | bool }` — task-local env vars
- `tools`: `{ tool: version }` — install specific tool versions just for this task
- `dir`: working directory (`{{cwd}}` for user's cwd)
- `sources`: glob patterns of input files (for up-to-date checks)
- `outputs`: `string[] | { auto: true }` — produced files; `auto=true` uses content-hash file
- `shell`: override shell (e.g. `bash -c`, `node -e`)
- `alias`: `string | string[]` — alternate task names
- `description`: string shown in help and `mise run`
- `hide`: bool — exclude from listings
- `confirm`: string or `{ message, default }` — prompt before running
- `raw`: bool — direct stdin/stdout/stderr pass-through (no redaction)
- `raw_args`: bool — pass all args verbatim, bypass mise's arg parser
- `interactive`: bool — exclusive I/O lock (stdin/stdout/stderr, blocks other tasks)
- `quiet`: bool — suppress mise's echo of the command being run
- `silent`: bool | `"stdout"` | `"stderr"` — suppress output streams
- `usage`: string — [usage spec](https://usage.jdx.dev/) for args/flags/completions
- `vars`: `{ key: value }` — task-local template vars (not env vars)
- `redactions`: `string[]` — env var names/globs to redact from output
- `file`: string — external script path (local or remote HTTP/git)
- `timeout`: duration string (e.g. `30s`, `5m`)
- `extends`: string — inherit from a `[task_templates.*]` definition (experimental)

**FOSS candidates:** N/A — this is a config primitive webular consumes, not implements. The _run_ engine analogue in Node.js is `execa` (npm) or Bun's `$` shell.

---

### 2. File Tasks (Script-as-Task)

**Category:** task/orchestration

**Purpose:** Executable files in `mise-tasks/`, `.mise/tasks/`, etc. become tasks automatically. They can carry `#MISE` header comments for configuration and `#USAGE` comments for argument specs. This enables webular to ship multi-language task scripts (bash, python, node, deno, bun) without embedding them in TOML strings.

**Key parameters (via `#MISE` header comments):**
- `description`, `alias`, `sources`, `outputs`, `env`, `depends`, `tools`, `dir`
- Shebang determines interpreter: `#!/usr/bin/env bash`, `#!/usr/bin/env node`, `#!/usr/bin/env -S deno run`, `#!/usr/bin/env bun`, `#!/usr/bin/env python`, etc.

**Task discovery directories (default):**
- `mise-tasks/`, `.mise-tasks/`, `.mise/tasks/`, `mise/tasks/`, `.config/mise/tasks/`

**Task grouping:** sub-directories auto-prefix task names with `:`; e.g. `test/integration` → task `test:integration`.

**FOSS candidates:** Any executable script. For auto-discovery of scripts as tasks, analogues include: `npm scripts` (package.json), `just` (Justfile), `task` (Taskfile.yml).

---

### 3. Task Dependency Graph (DAG Execution)

**Category:** task/orchestration

**Purpose:** mise builds a directed acyclic graph (DAG) from `depends`, `depends_post`, and `wait_for` relationships and executes tasks in parallel where possible. This is the **core control-flow primitive** for webular pipelines — fan-out, fan-in, conditional runs.

**Key behaviors:**
- `depends`: must complete before this task (prerequisite)
- `depends_post`: runs after this task (cleanup/notify)
- `wait_for`: soft dependency — only waits if the other task is also in the current run
- Parallel execution up to `--jobs N` (default 4); override with `MISE_JOBS`
- Deduplication: multiple tasks sharing the same dependency run it only once
- Failure propagation: if a dependency fails, its dependents do not run
- Cross-directory dependencies: `../api:build`
- Glob dependencies: `depends = ["lint:*"]`
- Argument/env forwarding to dependencies via `{{usage.*}}` templates or `{ task, args, env }` syntax

**Key CLI flags:**
- `--jobs / -j <N>`: parallelism
- `--skip-deps`: run only named tasks, skip dependencies
- `--no-deps`: skip tool auto-install
- `--force`: ignore sources/outputs up-to-date check
- `--dry-run / -n`: print execution plan without running
- `--continue-on-error / -c`: keep going even if a task fails
- `--timeout <DURATION>`: task timeout

**FOSS candidates (DAG/pipeline execution in Node.js/Rust):**
- npm: `concurrently`, `npm-run-all`, `p-queue`, `bottleneck`
- Rust crates: `tokio` (async runtime), `petgraph` (DAG), `futures` (join/select)
- Python: `dask`, `prefect`, `luigi`
- General: GNU `make`, `just`, `nx` (JS monorepo)

---

### 4. Parallel Task Execution with Output Multiplexing

**Category:** task/orchestration

**Purpose:** When multiple tasks run concurrently, mise captures and multiplexes their stdout/stderr without interleaving. Selectable output modes control the display.

**Output modes (`--output / -o` or `task.output` setting):**
- `prefix` — line-buffered with task-name prefix (default when jobs > 1)
- `interleave` — raw pass-through (default when jobs == 1)
- `keep-order` — stream one task live, buffer others, print in definition order
- `replacing` — stdout replaced each update (like a progress spinner)
- `timed` — only show lines that take > 1s
- `quiet` — only task output, no mise metadata
- `silent` — suppress all output including task stdout/stderr

**FOSS candidates:**
- npm: `listr2` (multi-task progress UI), `ora` (spinner), `ink` (React for CLI)
- Rust: `indicatif` (progress bars), `console` (terminal styling)

---

### 5. Source/Output Freshness Checking (Incremental Builds)

**Category:** task/orchestration

**Purpose:** Skip task execution when inputs (`sources`) are older than outputs (`outputs`). Analogous to Make's target rules. Enables webular to avoid re-scraping/re-extracting unchanged content.

**Key behaviors:**
- Glob patterns in `sources` and `outputs`
- Negation prefix `!` in sources to exclude patterns (gitignore-style)
- `outputs = { auto = true }` — uses an internal BLAKE3-hashed state file
- `MISE_TASK_SOURCE_FRESHNESS_EQUAL_MTIME_IS_FRESH`: toggle `<=` vs `<` mtime comparison
- `MISE_TASK_SOURCE_FRESHNESS_HASH_CONTENTS`: use BLAKE3 content hashing instead of mtime
- Dependency invalidation: if a depended-upon task runs (its sources changed), the dependent also re-runs even if its own sources are unchanged
- `task_source_files()` Tera function — resolve glob patterns to file list inside scripts

**FOSS candidates:**
- npm: `chokidar` (file watching), `glob` / `fast-glob` (glob expansion), `make` (mtime-based freshness)
- Rust: `notify` (fs events), `globset` (globs), `blake3` (hashing)
- Node: `ts-morph` / `@parcel/watcher`

---

### 6. File Watching (`mise watch`)

**Category:** task/orchestration

**Purpose:** Continuously run tasks when source files change. Wraps `watchexec` for robust cross-platform filesystem event watching with debounce, ignore rules, signal handling, and selective event filtering. webular uses this for live-crawl-and-rebuild pipelines.

**Key flags:**
- `-w / --watch <PATH>`: watch specific path(s)
- `-W / --watch-non-recursive <PATH>`: non-recursive watch
- `-F / --watch-file <PATH>`: watch from file list
- `-c / --clear <clear|reset>`: clear terminal before each run
- `-o / --on-busy-update <queue|do-nothing|restart|signal>`: behavior during active run
- `-r / --restart`: shorthand for `--on-busy-update=restart`
- `-s / --signal <SIGNAL>`: signal to send to running process
- `-d / --debounce <TIMEOUT>`: debounce window (default 50ms)
- `-e / --exts <EXTENSIONS>`: filter to file extensions
- `-f / --filter <PATTERN>`: glob filter (include)
- `-i / --ignore <PATTERN>`: glob filter (exclude)
- `--fs-events <EVENTS>`: filter to specific event types (access/create/remove/rename/modify/metadata)
- `--emit-events-to <MODE>`: expose event data to subprocess (environment/stdio/file/json-stdio/json-file/none)
- `--poll <INTERVAL>`: polling fallback for network drives
- `--no-vcs-ignore`, `--no-project-ignore`, `--no-global-ignore`: control ignore file loading
- `--skip-deps`: run only named tasks

**FOSS candidates (file watching):**
- npm: `chokidar`, `@parcel/watcher`, `watchexec` (binary), `nodemon`
- Rust: `notify` crate, `watchexec` (the underlying binary)
- Python: `watchdog`

---

### 7. Task Arguments and Usage Spec

**Category:** task/orchestration

**Purpose:** Tasks can define typed CLI arguments and flags using the [usage spec](https://usage.jdx.dev/) (a KDL-like DSL). Arguments become shell env vars (`usage_<name>`) and Tera template vars (`{{usage.<name>}}`). Enables webular tasks to expose a full CLI with validation, help generation, tab-completion, and choices.

**Usage spec primitives:**
- `arg "<name>"` / `arg "[name]"` — required/optional positional arg
  - `help`, `long_help`, `default`, `env` (backing env var), `var=#true` (variadic), `var_min`, `var_max`, `choices "a" "b"`, `double_dash`, `hide=#true`
- `flag "-s --long"` — boolean flag
  - `help`, `default`, `env`, `count=#true` (countable `-vvv`), `negate="--no-x"`, `global=#true`, `hide=#true`
- `flag "--name <val>"` — flag with value; same attributes as arg
- `complete "argname" run="cmd"` — shell completion from command output
  - `descriptions=#true` — parse `value:description` pairs

**Variable access in task scripts:**
- Shell: `${usage_name?}` (required), `${usage_name:-default}` (with default), `${usage_name:+value}` (conditional)
- Tera: `{{ usage.name }}`, `{{ usage["dry-run"] }}`, `{% for f in usage.files %}`

**Priority order:** CLI arg > env var backing (`env=`) > `default`

**FOSS candidates:**
- npm: `yargs`, `commander`, `meow`, `oclif` (CLI framework)
- Rust: `clap` (the actual underlying library in mise)
- Shell completion: `usage` CLI (https://usage.jdx.dev/) — the spec parser
- Bun: native CLI arg parsing with `Bun.argv`

---

### 8. Tera Template Engine

**Category:** template/code-generation

**Purpose:** mise uses [Tera](https://keats.github.io/tera/) (Rust Jinja2-equivalent) to render configuration values in `mise.toml`, `.tool-versions`, and task run scripts. This is the **interpolation engine** webular uses for dynamic config, env variable construction, and conditional logic in pipeline definitions.

**Template context variables:**
- `env`: `HashMap<String, String>` — current OS environment
- `cwd`: current working directory
- `config_root`: directory containing `mise.toml`
- `mise_bin`, `mise_pid`, `mise_env`
- `xdg_cache_home`, `xdg_config_home`, `xdg_data_home`, `xdg_state_home`
- `tools.<name>.version`, `tools.<name>.path` (with `tools = true` in env directive)
- `usage`: parsed task args map (in task run scripts)
- `vars.*`: user-defined vars from `[vars]` section

**Tera built-in functions (selection):**
- `range(end, [start], [step_by])`, `now([timestamp], [utc])`, `throw(message)`, `get_random(end, [start])`, `get_env(name, [default])`

**Mise-added functions:**
- `exec(command, [cache_key], [cache_duration])` — shell command output (with optional caching)
- `arch()`, `os()`, `os_family()`, `num_cpus()`
- `choice(n, alphabet)` — random string generation
- `read_file(path)` — file contents as string
- `task_source_files()` — resolved source glob file list

**Mise-added filters:**
- `hash([algorithm], [len])` — SHA256/BLAKE3 hash
- `hash_file([len])` — BLAKE3 file hash
- `absolute`, `canonicalize`, `basename`, `dirname`, `extname`, `file_stem`, `file_size`, `last_modified`
- `join_path` — join path array
- `quote`, `kebabcase`, `lowercamelcase`, `uppercamelcase`, `snakecase`, `shoutysnakecase`

**Mise-added tests:** `is dir`, `is file`, `is exists`

**FOSS candidates:**
- npm: `nunjucks` (Jinja2 for JS), `handlebars`, `eta`, `ejs`
- Rust: `tera` (the actual library used), `minijinja`
- Python: `jinja2`

---

### 9. Remote Task Files

**Category:** task/orchestration

**Purpose:** Task `file` property can reference remote scripts fetched via HTTP or Git. Cached in `MISE_CACHE_DIR`. Enables shared task libraries across projects — analogue for webular's shared pipeline recipes.

**Protocols supported:**
- HTTP: `file = "https://example.com/build.sh"`
- Git SSH: `file = "git::ssh://git@github.com/org/repo.git//path?ref=v1.0.0"`
- Git HTTPS: `file = "git::https://github.com/org/repo.git//path?ref=main"`
- URL format: `git::<protocol>://<url>//<path>?<ref>` (ref optional, defaults to repo default branch)

**Cache behavior:**
- Cached in `MISE_CACHE_DIR`
- `MISE_TASK_REMOTE_NO_CACHE=true` or `--no-cache` disables cache
- `mise cache clear` resets

**Remote git includes** (for task directories, experimental):
```toml
[task_config]
includes = ["git::https://github.com/myorg/shared-tasks.git//tasks?ref=main"]
```

**FOSS candidates:**
- npm: `degit`, `download` (file fetching), `simple-git` (git ops)
- Bun: native `fetch()` + Bun.file()
- Rust: `reqwest`, `git2`

---

### 10. Task Templates (Reusable Task Definitions)

**Category:** task/orchestration

**Purpose:** Define abstract task definitions in `[task_templates.*]` and extend them per-task with `extends`. Enables DRY task libraries for monorepos. Merge semantics: `tools` and `env` deep-merge; `run`, `depends`, `sources`, `outputs` override completely.

**Key TOML syntax:**
```toml
[task_templates."python:build"]
run = "uv build"
tools = { python = "3.12", uv = "latest" }
env = { PYTHONPATH = "src" }

[tasks.build]
extends = "python:build"
run = "uv build --wheel"  # override run, keeps tools/env from template
```

**Merge field behavior:**
- `run`, `run_windows`, `depends`, `depends_post`, `wait_for`, `sources`, `outputs`: local completely overrides
- `tools`, `env`: deep merge (local adds/overrides template entries)
- `description`, `shell`, `timeout`: local overrides if set
- `quiet`, `hide`, `raw`: NOT inherited (must be set explicitly)
- Sandbox allow fields: combined; deny fields: composed

**Requires:** `[settings] experimental = true`

**FOSS candidates:** N/A (configuration DSL pattern; closest analogue in JS is `extends` in `tsconfig.json` or `eslint` flat config)

---

### 11. Monorepo Task Orchestration

**Category:** task/orchestration

**Purpose:** Unified task namespace across a monorepo. Sub-project tasks are auto-discovered and prefixed with their relative path. Wildcard patterns enable cross-project task execution. Tool and env layering from parent configs. Enables webular to run pipeline steps across multiple service directories from a single root.

**Activation:**
```toml
# root mise.toml
experimental_monorepo_root = true
[monorepo]
config_roots = ["packages/frontend", "packages/backend", "services/*"]
```

**Task path syntax:**
- `//projects/frontend:build` — absolute from monorepo root
- `:build` — relative to current config_root
- `//projects/...:build` — `...` matches any depth
- `//...:build` — all projects
- `//projects/frontend:*` — all tasks in a project

**Environment layering:**
1. Global/parent tools and env (base)
2. Subdirectory config_root overrides (merged on top)
3. Task-level `tools` and `env` (highest priority)

**Key settings:**
- `task.monorepo_depth`: how deep to search (default 5)
- `task.monorepo_exclude_dirs`: dirs to skip (default: node_modules, target, dist, build)
- `task.monorepo_respect_gitignore`: skip .gitignore'd dirs (default true)

**FOSS candidates:**
- npm: `nx`, `turborepo`, `lerna`, `moon`
- Rust: `cargo workspaces`
- General: `bazel`, `buck2`

---

### 12. Task Dependency Visualization

**Category:** task/orchestration

**Purpose:** Inspect and export the task dependency graph. Essential for webular pipeline debugging and documentation.

**CLI:** `mise tasks deps [--dot] [--hidden] [TASKS...]`
- No args: show all task dependencies
- `--dot`: output Graphviz DOT format for visualization
- `--hidden`: include hidden tasks

**FOSS candidates:**
- npm: `d3-dag`, `dagre`, `graphviz-node`
- Rust: `petgraph` (DOT output), `daggy`
- CLI: `dot` (Graphviz), `mermaid-cli`

---

### 13. Task Validation

**Category:** task/orchestration

**Purpose:** Static analysis of task definitions before running. Catches common errors programmatically.

**CLI:** `mise tasks validate [--errors-only] [--json] [TASKS...]`

**Validation checks performed:**
- Circular dependency detection
- Missing task references
- Usage spec parsing errors (`#USAGE` directives)
- Timeout format validation
- Alias conflict detection
- File existence for file-based tasks
- Directory template validation
- Shell executable existence
- Glob pattern validation
- Run entry validity

**FOSS candidates:**
- npm: `ajv` (JSON schema), `zod` (runtime validation)
- Rust: `serde` + custom validators

---

### 14. Task Documentation Generation

**Category:** task/code-generation

**Purpose:** Auto-generate markdown documentation from task definitions and usage specs. Can inject into existing files or produce standalone docs. webular can use this to auto-document its pipeline catalog.

**CLI:** `mise generate task-docs [FLAGS]`
- `-i / --inject`: inject into existing file between `<!-- mise-tasks -->` ... `<!-- /mise-tasks -->` markers
- `-I / --index`: write only a task index (for use with `--multi`)
- `-m / --multi`: one doc file per task (requires `--output` to be a directory)
- `-o / --output <PATH>`: output file or directory
- `-r / --root <DIR>`: root directory to search for tasks
- `-s / --style <simple|detailed>`: documentation style (default: simple)

**FOSS candidates:**
- npm: `typedoc` (for code), `jsdoc`, custom markdown generation with `marked`
- General: any markdown templating

---

### 15. Task Stub Generation

**Category:** task/code-generation

**Purpose:** Generate executable wrapper scripts in `./bin/<task>` so contributors can run tasks without installing mise. Pairs with `mise generate bootstrap`.

**CLI:** `mise generate task-stubs [-d <DIR>] [-m <MISE_BIN>]`
- `-d / --dir <DIR>`: output directory (default: `bin`)
- `-m / --mise-bin <PATH>`: path to mise binary (default: `mise`; use `./bin/mise` for self-contained setups)

**FOSS candidates:**
- npm: `npm link`, `bin` field in `package.json`

---

### 16. Task Information Introspection

**Category:** task/orchestration

**Purpose:** Programmatic access to task metadata. Enables webular to build task registry UIs or pipeline graphs.

**CLI:** `mise tasks info [-J --json] <TASK>`

**JSON output fields:**
```json
{
  "name": "test",
  "aliases": "t",
  "description": "...",
  "source": "~/src/myproj/mise.toml",
  "depends": [],
  "env": {},
  "dir": null,
  "hide": false,
  "raw": false,
  "sources": [],
  "outputs": [],
  "run": ["echo \"testing!\""],
  "file": null,
  "usage_spec": {}
}
```

**FOSS candidates:** N/A (introspection primitive)

---

### 17. Task Listing

**Category:** task/orchestration

**Purpose:** Enumerate all available tasks with metadata. Useful for webular CLI discovery and interactive task pickers.

**CLI:** `mise tasks ls [FLAGS]`
- `-g / --global`: only global tasks
- `-l / --local`: only non-global tasks
- `-x / --extended`: show all columns
- `--all`: include entire monorepo (siblings/descendants)
- `--hidden`: show hidden tasks
- `--name-only`: one name per line (for fzf/piping)
- `--no-header`: suppress table header
- `-J / --json`: JSON output
- `--sort <name|alias|description|source>`
- `--sort-order <asc|desc>`

**FOSS candidates:** N/A (enumeration primitive)

---

### 18. Environment Variable Management

**Category:** environment/configuration

**Purpose:** Declarative per-project environment variables loaded automatically on `cd` (with shell activation) or available via `mise exec` / `mise run`. Full support for dotenv files, secret encryption, shell script sourcing, PATH augmentation, lazy eval after tools, redaction, and required-variable enforcement.

**Key `[env]` directives:**
- Direct assignment: `KEY = "value"` or `KEY = false` (unset)
- `env._.file`: load from `.env`, `.env.json`, `.env.yaml` (dotenvy)
- `env._.path`: append to `PATH`
- `env._.source`: source a bash script (captures exported vars)
- `{ value = "...", tools = true }`: lazy eval — resolved after tools are activated
- `{ value = "...", redact = true }`: mark sensitive (redacts in task output)
- `{ required = true }` or `{ required = "help text" }`: fail if not set
- `_.file = { path = "...", redact = true }`: redact entire file's vars

**Tera templates in env values:** full template context available  
**Shell-style expansion:** `env_shell_expand = true` enables `$VAR` / `${VAR:-default}` syntax

**CLI:**
- `mise set KEY=value` — write to mise.toml
- `mise set --prompt KEY` — interactive (hidden input)
- `mise set --stdin KEY` — multiline from stdin
- `mise set --age-encrypt KEY=secret` — encrypt at rest with age
- `mise env [-s <shell>] [--json] [--dotenv] [--redacted] [--values]` — export env
- `mise unset KEY` — remove from mise.toml

**FOSS candidates:**
- npm: `dotenv`, `dotenv-expand`, `cross-env`
- Rust: `dotenvy` (the actual crate used), `envy`
- Encryption: `age` (the binary/crate), `sops`

---

### 19. Secrets Management

**Category:** environment/configuration

**Purpose:** Encrypt environment variable values at rest using `age` encryption or SOPS. Encrypted values are decrypted transparently when tasks run. webular uses this for API keys in pipeline configs.

**Supported backends:**
- `age` encryption (`mise set --age-encrypt`, key file at `~/.config/mise/age.txt`)
  - `--age-key-file <PATH>`: custom identity file
  - `--age-recipient <PUBKEY>`: x25519 recipient
  - `--age-ssh-recipient <PATH_OR_PUBKEY>`: SSH key as recipient
- SOPS (`env._.file = { path = ".env.sops", sops = true }`)

**FOSS candidates:**
- npm: `@mozilla/sops`, `dotenv-vault`
- CLI: `age` (https://github.com/FiloSottile/age), `sops` (https://github.com/getsops/sops)
- Rust: `age` crate

---

### 20. Config Environments (Profile Switching)

**Category:** environment/configuration

**Purpose:** Maintain separate `mise.<env>.toml` files for different environments (dev/staging/prod). Switch via `MISE_ENV`, `-E flag`, or `.miserc.toml`. Enables webular to have different scraping/pipeline configs per environment.

**Priority chain (highest to lowest):**
1. `mise.<env>.local.toml`
2. `mise.local.toml`
3. `mise.<env>.toml`
4. `mise.toml`

**Multiple environments:** `MISE_ENV=ci,test` (last takes precedence)

**FOSS candidates:**
- npm: `dotenv-flow`, `env-cmd`
- General: 12-factor app pattern with `NODE_ENV`

---

### 21. Lifecycle Hooks

**Category:** environment/configuration

**Purpose:** Execute scripts or tasks automatically on directory enter/leave/cd, and on tool install/postinstall. The `watch_files` hook enables reactive pipeline triggers. Hooks are the **event-driven primitive** that webular can use to auto-trigger crawls on config change.

**Hook types:**
- `[hooks] enter`: run when entering project directory (once)
- `[hooks] leave`: run when leaving project directory
- `[hooks] cd`: run on every directory change within project
- `[hooks] preinstall`: before tools are installed
- `[hooks] postinstall`: after tools are installed (receives `MISE_INSTALLED_TOOLS` JSON array)

**Tool-level postinstall:**
```toml
[tools]
node = { version = "20", postinstall = "npm install -g pnpm" }
```
Receives: `MISE_TOOL_NAME`, `MISE_TOOL_VERSION`, `MISE_TOOL_INSTALL_PATH`

**Watch files hook:**
```toml
[[watch_files]]
patterns = ["src/**/*.rs"]
run = "cargo fmt"
# OR
task = "sync-deps"
```
Receives: `MISE_WATCH_FILES_MODIFIED` (colon-separated file list)

**Hook execution env vars:**
- `MISE_ORIGINAL_CWD`, `MISE_PROJECT_ROOT`, `MISE_PREVIOUS_DIR`

**Hook syntax options:**
- String shorthand: `enter = "echo hi"`
- Inline run: `enter = { run = "echo hi", shell = "bash -c" }`
- Task reference: `enter = { task = "setup" }`
- Array: `enter = ["cmd1", { task = "setup" }]`
- Shell hook (current shell): `enter = { shell = "bash", script = "source completions.sh" }`
- Array-of-tables: `[[hooks.cd]]` for multiple same-type hooks

**FOSS candidates:**
- npm: `husky` (git hooks), `chokidar` (file watching)
- Shell: `direnv` (dir-enter env loading)

---

### 22. `mise exec` — Isolated Tool Execution

**Category:** environment/configuration

**Purpose:** Run a command with specific tool versions active without modifying the shell session. Supports experimental sandboxing (allow/deny for env, network, filesystem). webular uses this to run extraction tools in a controlled environment.

**CLI:** `mise exec [FLAGS] [TOOL@VERSION]… [-- COMMAND]…`
- `--command / -c <CMD>`: command string
- `--jobs / -j <N>`: parallel tool installs
- `--raw`: direct stdin/stdout/stderr
- `--no-deps`: skip tool auto-install
- `--fresh-env`: bypass env cache

**Experimental sandboxing flags:**
- `--deny-all`: block reads, writes, network, env vars
- `--deny-env`: block env var inheritance
- `--deny-net`: block all network
- `--deny-read`: block filesystem reads
- `--deny-write`: block filesystem writes
- `--allow-env <VAR>` (wildcard supported): allow specific env vars (implies deny all others)
- `--allow-net <HOST>`: allow specific hosts
- `--allow-read <PATH>`: allow specific read paths
- `--allow-write <PATH>`: allow specific write paths

Same sandboxing flags available on `mise run` (tasks).

**FOSS candidates:**
- npm: `execa` (subprocess execution), `cross-spawn`
- Rust: `std::process::Command`, `tokio::process`
- Sandbox: `deno` (native permissions model), `firejail`, `bubblewrap`

---

### 23. Configuration Hierarchy and Merging

**Category:** environment/configuration

**Purpose:** mise merges configuration from system → global → project directories (walk up) → local overrides. Understanding this enables webular to layer its config for user/project/environment-specific pipeline overrides.

**File precedence (highest to lowest within a directory):**
1. `mise.local.toml` (local, git-ignored)
2. `mise.toml`
3. `mise/config.toml`, `.mise/config.toml`, `.config/mise/config.toml`

**Merge behavior by section:**
- `[tools]`: additive with overrides
- `[env]`: additive with overrides
- `[tasks]`: replaced per task name
- `[settings]`: additive with overrides
- `[vars]`: additive with overrides

**Key env vars:**
- `MISE_DATA_DIR`: tool/plugin install location
- `MISE_CACHE_DIR`: internal cache
- `MISE_CEILING_PATHS`: stop searching upward at these paths
- `MISE_TRUSTED_CONFIG_PATHS`: auto-trust these paths
- `MISE_ENV`: activate environment-specific config
- `MISE_HTTP_TIMEOUT`: HTTP timeout for downloads (default 30s)
- `MISE_JOBS`: default parallelism
- `MISE_ENV_FILE`: dotenv file auto-loaded from cwd upwards

**FOSS candidates:** N/A (hierarchical config pattern; closest npm analogue: `cosmiconfig`, `rc`)

---

### 24. Task Configuration Settings (Global)

**Category:** environment/configuration

**Purpose:** Global settings controlling task behavior. webular can set these via `[settings]` in `mise.toml` or environment variables.

**Key settings:**
- `jobs`: default parallelism (default 4)
- `task.output`: default output mode
- `task.timeout`: global default timeout for all tasks
- `task.timings`: show task timing by default
- `task.skip`: tasks to always skip
- `task.skip_depends`: globally skip dependencies
- `task.run_auto_install`: auto-install missing tools (default true)
- `task.show_full_cmd`: show full command without truncation
- `task.remote_no_cache`: always fetch remote tasks fresh
- `task.monorepo_depth`: monorepo search depth
- `task.monorepo_exclude_dirs`: excluded dirs in monorepo discovery
- `task.monorepo_respect_gitignore`: respect .gitignore in monorepo (default true)
- `task.source_freshness_equal_mtime_is_fresh`: freshness comparison mode
- `task.source_freshness_hash_contents`: use BLAKE3 content hashing for freshness
- `task.disable_spec_from_run_scripts`: skip two-pass Tera parsing for usage specs
- `experimental`: enable experimental features
- `experimental_monorepo_root`: mark as monorepo root

**FOSS candidates:** N/A (settings primitive)

---

## Summary of Unique Primitives Relevant to webular

1. **DAG-based parallel task execution** with `depends`/`depends_post`/`wait_for` — the core pipeline engine
2. **Sources/outputs freshness** — skip-if-unchanged for expensive scraping/extraction steps
3. **`mise watch`** via watchexec — file-change-triggered pipeline reruns
4. **Usage spec** (KDL DSL) — typed CLI args/flags for task scripts with auto-completions and help
5. **Tera template engine** — dynamic config, conditional logic, file reading, command execution in config
6. **Remote task files** via HTTP/Git — shared pipeline recipe libraries
7. **Task templates** (`extends`) — DRY inheritance for repeated pipeline shapes
8. **Monorepo task namespacing** — cross-service pipeline orchestration with wildcards
9. **Environment redaction** — safe handling of API keys and secrets in pipeline output
10. **Lifecycle hooks** (`enter`/`leave`/`cd`/`postinstall`) + `watch_files` — reactive pipeline triggers
11. **Sandboxed execution** (`--deny-*`/`--allow-*`) — security boundary for untrusted pipeline steps
12. **Task documentation generation** — auto-docs from usage specs (injected into markdown)
13. **Task stub generation** — zero-install wrappers for contributors
14. **Config environment switching** (`MISE_ENV`) — dev/staging/prod pipeline profiles
15. **Secrets at rest** with `age`/SOPS — encrypted API keys in mise.toml

---

## FOSS Library Quick Reference (for webular implementation)

| Primitive | Node/Bun (npm) | Rust (crates.io) |
|---|---|---|
| Task DAG execution | `p-queue`, `bottleneck`, `concurrently`, `npm-run-all` | `petgraph`, `tokio`, `futures` |
| File watching | `chokidar`, `@parcel/watcher`, `nodemon` | `notify`, `watchexec` |
| Glob matching | `fast-glob`, `micromatch`, `glob` | `globset`, `walkdir` |
| Process spawning | `execa`, `cross-spawn`, `zx` | `std::process`, `tokio::process` |
| Templates (Jinja2) | `nunjucks`, `handlebars`, `eta` | `tera`, `minijinja` |
| Dotenv loading | `dotenv`, `dotenv-expand` | `dotenvy` |
| Content hashing | `crypto` (built-in), `xxhash`, `blake3` | `blake3`, `sha2` |
| CLI arg parsing | `yargs`, `commander`, `meow` | `clap` |
| Secrets/encryption | `@noble/ciphers` | `age` crate |
| Progress/output | `listr2`, `ora`, `ink` | `indicatif`, `console` |
| Config hierarchy | `cosmiconfig`, `rc` | `config`, `figment` |

---

_Coverage: 30 deep-read pages / 225 total URLs. Remaining URLs are primarily dev-tool backends (cargo/npm/pip/go/ruby backends), language-specific setup guides, plugin development APIs, and registry/install pages — not directly relevant to webular's task orchestration use case._
