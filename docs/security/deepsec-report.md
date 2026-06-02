# Vulnerability Scan Report

| Field | Value |
|-------|-------|
| Project | webular |
| Date | 2026-06-02T08:45:22.394Z |
| Files tracked | 33 |
| Files analyzed | 33 |
| Total findings | 26 |

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 22 |
| HIGH_BUG | 0 |
| BUG | 4 |

## MEDIUM (22)

### GitHub Actions are not pinned to immutable commits

- **File:** `.github/workflows/ci.yml`
- **Lines:** 23, 24
- **Slug:** other-ci-supply-chain
- **Confidence:** high

The workflow executes actions via mutable major-version refs: actions/checkout@v4 and jdx/mise-action@v2. If one of those action tags is retargeted or the upstream action is compromised, arbitrary code can run in CI with the repository contents and the read-scoped GITHUB_TOKEN available to the job. The explicit contents: read permission reduces impact but does not prevent source or CI-environment exfiltration or build tampering.

**Recommendation:** Pin third-party and first-party actions to full commit SHAs, and use Dependabot/Renovate or a similar process to review and update those SHAs intentionally.

---

### Unrestricted output path can overwrite arbitrary local files

- **File:** `src/cli/run.ts`
- **Lines:** 17, 25
- **Slug:** path-traversal
- **Confidence:** high

runWorkflow accepts opts.output and forwards it directly to emit. The imported emit implementation writes that path with Bun.write without constraining it to an approved directory, rejecting absolute paths or '..' traversal, or preventing overwrite/symlink targets. For runWorkflow-backed commands, an automating caller that passes attacker-controlled flags could let the attacker choose '-o/--output' and write workflow output, often including attacker-controlled remote page content, to any file writable by the invoking user.

**Recommendation:** Resolve output paths against an explicit safe output directory, reject absolute paths and parent-directory traversal unless explicitly trusted, and consider fail-if-exists semantics or a separate --force flag to avoid clobbering existing files.

---

### Unrestricted --output can overwrite arbitrary files

- **File:** `src/commands/answer.ts`
- **Lines:** 32, 34
- **Slug:** path-traversal
- **Confidence:** high

`values.output` is passed directly to `emit`, whose shared sink calls `Bun.write(opts.output, text)` without path validation, base-directory enforcement, symlink checks, or no-clobber behavior. If an integration exposes CLI flags to an attacker, `--output` can be set to an absolute path or `../` traversal path to overwrite files writable by the webular process.

**Recommendation:** For untrusted automation, canonicalize output paths against an allowed output directory, reject absolute paths and `..` traversal, and consider exclusive/no-clobber writes unless overwrite is explicitly requested.

---

### Unrestricted --output can overwrite arbitrary files

- **File:** `src/commands/audit.ts`
- **Lines:** 24, 26
- **Slug:** path-traversal
- **Confidence:** high

`values.output` is passed directly to `emit`, whose shared sink calls `Bun.write(opts.output, text)` without path validation, base-directory enforcement, symlink checks, or no-clobber behavior. If an integration exposes CLI flags to an attacker, `--output` can be set to an absolute path or `../` traversal path to overwrite files writable by the webular process.

**Recommendation:** For untrusted automation, canonicalize output paths against an allowed output directory, reject absolute paths and `..` traversal, and consider exclusive/no-clobber writes unless overwrite is explicitly requested.

---

### Unrestricted --output can overwrite arbitrary files

- **File:** `src/commands/diagram.ts`
- **Lines:** 29, 31
- **Slug:** path-traversal
- **Confidence:** high

`values.output` is passed directly to `emit`, whose shared sink calls `Bun.write(opts.output, text)` without path validation, base-directory enforcement, symlink checks, or no-clobber behavior. If an integration exposes CLI flags to an attacker, `--output` can be set to an absolute path or `../` traversal path to overwrite files writable by the webular process.

**Recommendation:** For untrusted automation, canonicalize output paths against an allowed output directory, reject absolute paths and `..` traversal, and consider exclusive/no-clobber writes unless overwrite is explicitly requested.

---

### Unrestricted --output can overwrite arbitrary files

- **File:** `src/commands/doctor.ts`
- **Lines:** 21, 23
- **Slug:** path-traversal
- **Confidence:** high

`values.output` is passed directly to `emit`, whose shared sink calls `Bun.write(opts.output, text)` without path validation, base-directory enforcement, symlink checks, or no-clobber behavior. If an integration exposes CLI flags to an attacker, `--output` can be set to an absolute path or `../` traversal path to overwrite files writable by the webular process.

**Recommendation:** For untrusted automation, canonicalize output paths against an allowed output directory, reject absolute paths and `..` traversal, and consider exclusive/no-clobber writes unless overwrite is explicitly requested.

---

### Untrusted --output path can overwrite arbitrary files

- **File:** `src/commands/map.ts`
- **Lines:** 31, 33
- **Slug:** path-traversal
- **Confidence:** high

Under the stated automation trust boundary, this command accepts attacker-controlled CLI flags and passes values.output directly to emit. parseFlags exposes --output/-o as a common string option, and src/core/output.ts writes it with Bun.write without normalization, containment checks, symlink protection, or overwrite controls. An attacker who can influence the map command arguments can choose an absolute or traversal path and cause the command output to overwrite files writable by the invoking user.

**Recommendation:** Centralize output path validation in emit or the CLI parser. Resolve paths with realpath/normalize, require them to stay inside an explicit output directory, reject absolute paths or traversal when input is untrusted, and use no-overwrite/no-follow semantics unless overwrite is explicitly intended.

---

### Untrusted media output path can overwrite arbitrary files

- **File:** `src/commands/media.ts`
- **Lines:** 21, 29, 31
- **Slug:** path-traversal
- **Confidence:** high

The command accepts --url and --output from CLI flags, places them into inputData, and runs mediaWorkflow. Downstream, download mode fetches bytes from the supplied URL and writes them to the supplied dest with Bun.write without resolving the path, constraining it to a safe output directory, rejecting absolute or parent-directory paths, checking symlinks, or preventing overwrite. In the stated threat model where an automation layer may pass untrusted flag strings to this CLI, an attacker can choose both a remote payload URL and an output path such as an absolute path or ../ traversal path, causing file creation or overwrite as the invoking user.

**Recommendation:** For untrusted callers, resolve dest against an allowlisted output directory, reject absolute paths and paths escaping that directory, avoid following symlinks, and create files with exclusive/no-overwrite semantics. Keep arbitrary output paths only behind an explicitly trusted local-CLI mode.

---

### Unrestricted monitor database path can write outside the intended cache

- **File:** `src/commands/monitor.ts`
- **Lines:** 15, 16, 17, 31, 33
- **Slug:** path-traversal
- **Confidence:** high

`resolveDbPath` accepts `--db` or `WEBULAR_DB` verbatim, and `main` passes that value into the monitor workflow. The imported snapshot store opens `new Database(dbPath, { create: true })` and creates/writes the snapshots table without canonicalizing the path or restricting it to a cache directory. Under the stated threat model where an automating caller may pass attacker-controlled flags, this lets an attacker create or modify SQLite database files at arbitrary writable paths and potentially corrupt existing SQLite files under the invoking user's privileges.

**Recommendation:** Resolve monitor database paths under a dedicated app cache directory by default, reject absolute paths and parent-directory traversal for untrusted callers, and use explicit opt-in for user-selected external DB paths.

---

### Unrestricted --output can overwrite arbitrary files

- **File:** `src/commands/monitor.ts`
- **Lines:** 38, 40
- **Slug:** path-traversal
- **Confidence:** high

`values.output` is passed directly to `emit`, whose shared sink calls `Bun.write(opts.output, text)` without path validation, base-directory enforcement, symlink checks, or no-clobber behavior. If an integration exposes CLI flags to an attacker, `--output` can be set to an absolute path or `../` traversal path to overwrite files writable by the webular process.

**Recommendation:** For untrusted automation, canonicalize output paths against an allowed output directory, reject absolute paths and `..` traversal, and consider exclusive/no-clobber writes unless overwrite is explicitly requested.

---

### Untrusted --file path allows arbitrary local file read

- **File:** `src/commands/parse.ts`
- **Lines:** 14, 15, 21
- **Slug:** path-traversal
- **Confidence:** high

parse.ts accepts --file or a positional path and passes it unchanged into parseWorkflow. The workflow only validates that file is a non-empty string, then parseDocument reads it through Bun.file for text, HTML, DOCX, or PDF parsing. Under the stated automation trust boundary, an attacker who controls the file argument can use absolute paths or traversal to read any file accessible to the invoking user, with contents returned on stdout or written via --output.

**Recommendation:** Constrain parse inputs to a configured input directory or caller-provided allowlist. Resolve the path before reading, enforce realpath containment, reject traversal and unexpected symlinks, and consider extension, size, and file type validation before parsing.

---

### Untrusted --output path can overwrite arbitrary files

- **File:** `src/commands/parse.ts`
- **Lines:** 26, 28
- **Slug:** path-traversal
- **Confidence:** high

The parse command passes values.output directly to emit. parseFlags exposes --output/-o as a common string option, and src/core/output.ts writes it with Bun.write without normalization, containment checks, symlink protection, or overwrite controls. An attacker who can influence parse command arguments can choose an arbitrary writable path and overwrite files with parsed document output.

**Recommendation:** Centralize output path validation in emit or the CLI parser. Resolve paths with realpath/normalize, require them to stay inside an explicit output directory, reject absolute paths or traversal when input is untrusted, and use no-overwrite/no-follow semantics unless overwrite is explicitly intended.

---

### Untrusted --output path can overwrite arbitrary files

- **File:** `src/commands/research.ts`
- **Lines:** 32, 34
- **Slug:** path-traversal
- **Confidence:** high

research.ts accepts common CLI flags and passes values.output directly to emit. parseFlags exposes --output/-o as a common string option, and src/core/output.ts writes it with Bun.write without normalization, containment checks, symlink protection, or overwrite controls. Under the stated automation trust boundary, an attacker who can influence research command arguments can choose an absolute or traversal path and overwrite files writable by the invoking user.

**Recommendation:** Centralize output path validation in emit or the CLI parser. Resolve paths with realpath/normalize, require them to stay inside an explicit output directory, reject absolute paths or traversal when input is untrusted, and use no-overwrite/no-follow semantics unless overwrite is explicitly intended.

---

### Untrusted --output path can overwrite arbitrary files

- **File:** `src/commands/scrape.ts`
- **Lines:** 26, 28
- **Slug:** path-traversal
- **Confidence:** high

scrape.ts accepts common CLI flags and passes values.output directly to emit. parseFlags exposes --output/-o as a common string option, and src/core/output.ts writes it with Bun.write without normalization, containment checks, symlink protection, or overwrite controls. Because scrape output can be influenced by fetched remote content, an attacker who controls both the URL and output path in an automation context can write attacker-shaped data to arbitrary files writable by the invoking user.

**Recommendation:** Centralize output path validation in emit or the CLI parser. Resolve paths with realpath/normalize, require them to stay inside an explicit output directory, reject absolute paths or traversal when input is untrusted, and use no-overwrite/no-follow semantics unless overwrite is explicitly intended.

---

### Untrusted --output path can overwrite arbitrary files

- **File:** `src/commands/search.ts`
- **Lines:** 30, 32
- **Slug:** path-traversal
- **Confidence:** high

search.ts accepts common CLI flags and passes values.output directly to emit. parseFlags exposes --output/-o as a common string option, and src/core/output.ts writes it with Bun.write without normalization, containment checks, symlink protection, or overwrite controls. Under the stated automation trust boundary, an attacker who can influence search command arguments can choose an absolute or traversal path and overwrite files writable by the invoking user.

**Recommendation:** Centralize output path validation in emit or the CLI parser. Resolve paths with realpath/normalize, require them to stay inside an explicit output directory, reject absolute paths or traversal when input is untrusted, and use no-overwrite/no-follow semantics unless overwrite is explicitly intended.

---

### Redirect following can bypass crawl same-host scope

- **File:** `src/core/http.ts`
- **Lines:** 14, 18
- **Slug:** ssrf
- **Confidence:** high

httpGet always sets redirect: 'follow' and then fetches the caller-supplied URL. In the crawl flow, links are checked with sameHost before fetch, but the final redirected URL is never revalidated. A malicious same-host page can enqueue a same-host redirect URL that points to an internal or otherwise off-scope service, causing the crawler to fetch it despite the same-host boundary.

**Recommendation:** Do not force automatic redirects for scoped crawls. Use manual redirect handling for callers that impose URL boundaries, resolve each Location header, and revalidate scheme, hostname, and optionally port/origin before following each hop.

---

### agent-browser batch commands are forwarded as reparsed strings

- **File:** `src/lib/agentbrowser.ts`
- **Lines:** 23
- **Slug:** other-argument-injection
- **Confidence:** medium

runBatch passes caller-supplied command strings directly to `agent-browser batch`. The relevant workflows build those strings with interpolated URL and destination values, such as `open ${url}` and `screenshot ${dest}`. Because agent-browser batch argument mode reparses each string as a command, a hostile value containing whitespace or option-looking tokens can alter the browser command's arguments instead of being treated as one atomic URL/path. This is not shell RCE because Bun.spawn uses argv array form, but it is still argument injection into a privileged browser automation tool.

**Recommendation:** Change runBatch to accept structured argv arrays and invoke agent-browser's JSON batch form, for example `['open', url]` and `['screenshot', dest]`, or otherwise quote/escape arguments with agent-browser's documented parser and reject control characters and option-leading path values.

---

### Download output path can overwrite arbitrary writable files

- **File:** `src/lib/download.ts`
- **Lines:** 16, 22, 24
- **Slug:** path-traversal
- **Confidence:** high

downloadToFile writes attacker-controlled response bytes to `dest` verbatim when provided, and the fallback temp filename is predictable because it is based on Date.now and a URL-derived basename. If an automation layer accepts untrusted output paths, an attacker can write or overwrite files under the invoking user's privileges; with the default path, a local attacker can also attempt a symlink race in the shared temp directory.

**Recommendation:** For untrusted callers, restrict output to an approved directory after path normalization, reject absolute/traversal paths, and use randomly-created exclusive temp files or directories instead of predictable names.

---

### Downloads are fully buffered without a size limit

- **File:** `src/lib/download.ts`
- **Lines:** 23, 24
- **Slug:** other-denial-of-service
- **Confidence:** high

downloadToFile calls `res.arrayBuffer()` before writing and does not enforce a maximum Content-Length or streamed byte cap. A malicious URL can return an arbitrarily large response and exhaust memory, disk, or the automation worker running this CLI.

**Recommendation:** Stream the response to disk with backpressure and enforce a configurable maximum byte count before and during the download.

---

### Monitor database path is used as an unrestricted SQLite write target

- **File:** `src/lib/snapshot.ts`
- **Lines:** 25, 26, 41, 50
- **Slug:** path-traversal
- **Confidence:** high

compareAndStore opens the caller-controlled dbPath with `new Database(dbPath, { create: true })` and then creates or updates the snapshots table. Through `monitor --db` or WEBULAR_DB, an untrusted automation caller can cause the process to create files in arbitrary writable locations or modify an existing SQLite database under the invoking user's privileges.

**Recommendation:** Resolve dbPath against an approved application data directory for untrusted automation, reject absolute paths and `..` traversal unless explicitly enabled for trusted local use, and avoid following symlinks where possible.

---

### Unbounded batch size and concurrency can exhaust local resources

- **File:** `src/workflows/batch.ts`
- **Lines:** 8, 10, 11, 49, 50
- **Slug:** other-resource-exhaustion
- **Confidence:** medium

The workflow accepts an unbounded URL array and any positive integer concurrency, then constructs a Promise for every URL and runs up to `inputData.concurrency` scrapes in parallel. In the repo threat model where an automating caller may pass attacker-controlled flags or input files to the CLI, a very large URL list or concurrency value can exhaust memory, sockets, file descriptors, or outbound bandwidth.

**Recommendation:** Set conservative maximums for URL count and concurrency, reject excessive values at schema/CLI parsing time, and consider streaming large input files instead of materializing all work in one `Promise.all`.

---

### Unvalidated media destination allows arbitrary file overwrite

- **File:** `src/workflows/media.ts`
- **Lines:** 8, 11, 39, 43
- **Slug:** path-traversal
- **Confidence:** high

`dest` is accepted as an arbitrary string and passed directly to the download path or browser capture path. For downloads, the imported helper writes attacker-chosen URL bytes to that path; for screenshot/PDF capture, the same unvalidated path is passed to `agent-browser` and then read back with `Bun.file(dest)`. There is no normalization, base-directory restriction, traversal rejection, symlink protection, or overwrite guard. If an automation wrapper passes attacker-controlled `-o/--output`, the attacker can overwrite any file writable by the invoking user.

**Recommendation:** Resolve destinations under an explicit safe output directory, reject absolute paths and `..` traversal, avoid following unsafe symlinks, and use exclusive-create semantics unless the user explicitly opts into overwrite.

---

## BUG (4)

### Snapshot compare and update is not atomic

- **File:** `src/lib/snapshot.ts`
- **Lines:** 39, 41, 50
- **Slug:** other-race-condition
- **Confidence:** high

compareAndStore performs SELECT, then INSERT or UPDATE as separate statements without a transaction. Concurrent monitor runs for the same URL can both observe no row and race on the primary-key insert, or both diff against the same stale row and lose an intermediate snapshot update.

**Recommendation:** Wrap the read/compare/write sequence in a transaction, preferably `BEGIN IMMEDIATE`, and use an atomic upsert or optimistic `WHERE hash = ?` update to detect concurrent changes.

---

### Diagram render reports success even when mmdc fails

- **File:** `src/workflows/diagram.ts`
- **Lines:** 52, 53, 54
- **Slug:** other-error-handling
- **Confidence:** high

The render workflow spawns `bunx mmdc` for each `.mmd` file, awaits `proc.exited`, but never checks the exit code before adding the diagram to the `rendered` result. A failed render can therefore be reported as successful, leaving missing or stale SVG output and hiding tool failures from callers.

**Recommendation:** Capture stderr/stdout as needed, check the exit code from `proc.exited`, throw on nonzero, and only append to `rendered` after a successful render.

---

### Hard-coded diagrams path breaks non-local installs

- **File:** `src/workflows/diagram.ts`
- **Lines:** 9, 30, 45
- **Slug:** other-portability
- **Confidence:** high

`DIAGRAMS_DIR` is fixed to `/Users/kiren/dev/webular/docs/diagrams`. The default list/render behavior will fail or point at the wrong location when the package is installed or run from any other checkout path.

**Recommendation:** Resolve the diagrams directory relative to the module or project root, for example via `import.meta.url`, `WEBULAR_HOME`, or the mise config root.

---

### Task listing ignores mise failures

- **File:** `src/workflows/tasks.ts`
- **Lines:** 19, 24, 25, 30
- **Slug:** other-error-handling
- **Confidence:** high

The workflow reads stdout from `mise tasks ls`, awaits process exit, and then returns parsed task names without checking whether `mise` exited successfully. If `mise` is missing, misconfigured, or run in an invalid cwd, callers can receive a successful empty or partial task list instead of an error.

**Recommendation:** Read stderr, check the exit code returned by `proc.exited`, and throw or return a failed workflow result when `mise` exits nonzero.

---

