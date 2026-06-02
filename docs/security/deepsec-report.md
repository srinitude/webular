# Vulnerability Scan Report

| Field | Value |
|-------|-------|
| Project | webular |
| Date | 2026-06-02T18:58:16.267Z |
| Files tracked | 34 |
| Files analyzed | 34 |
| Total findings | 8 |

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 0 |
| MEDIUM | 6 |
| HIGH_BUG | 0 |
| BUG | 1 |

## CRITICAL (1)

### Sitemap discovery can follow attacker-controlled off-host sitemap URLs

- **File:** `src/commands/map.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 18, 24, 25, 26
- **Slug:** ssrf
- **Confidence:** high

The command accepts a caller-controlled URL, builds inputData from it, and starts mapWorkflow. In the imported workflow, fetchSitemapLinks constructs a Sitemapper instance for `${site}/sitemap.xml` and calls mapper.fetch(). Sitemapper recursively fetches `<sitemap><loc>` entries from a sitemap index without revalidating that those child sitemap URLs remain on the root host. A hostile site can return a sitemap index whose child loc points to an internal service such as localhost or a cloud metadata IP, causing the CLI host to make an off-scope request. This is not the intended initial user-supplied URL fetch; it is a remote-content-controlled scope escape.

**Recommendation:** Do sitemap discovery through a repo-controlled fetch path that validates every sitemap index loc against the original hostname before fetching it. Prefer fetchTextWithinHost-style manual redirect handling, reject private/internal address ranges where appropriate, and filter returned sitemap links to the intended scope.

---

## MEDIUM (6)

### Sitemap path bypasses the capped fetch helper

- **File:** `src/commands/map.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 23, 24, 25, 26
- **Slug:** other-resource-exhaustion
- **Confidence:** high

The map command passes the URL and optional limit into mapWorkflow, but the imported workflow fetches and parses the complete sitemap through Sitemapper before applying the result limit. That dependency buffers sitemap responses and performs synchronous gzip decompression/XML parsing without the 25 MB streamed cap used by fetchText. A hostile sitemap can therefore consume excessive memory or CPU before the command ever slices to the requested limit.

**Recommendation:** Replace or wrap Sitemapper with capped streaming fetch/decompression and bounded XML parsing. Enforce byte, entry-count, sitemap-index-count, and recursion-depth limits before parsing or recursing, and apply the user limit during collection rather than only after all sitemap data is loaded.

---

### Sandboxed media downloads can write outside WEBULAR_OUTPUT_DIR when -o is omitted

- **File:** `src/commands/media.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 31, 34
- **Slug:** other-sandbox-bypass
- **Confidence:** high

The command forwards dest as an optional value from --output. When an untrusted automation caller omits -o, src/workflows/media.ts only calls safePath when inputData.dest is present, then downloadToFile falls back to tempPath(), which writes under the OS temp directory via tmpdir(). With WEBULAR_SANDBOX=1, this lets attacker-controlled response bytes be written outside the configured sandbox base. The destination is random rather than attacker-chosen, so this is not arbitrary overwrite, but it violates the documented sandbox boundary.

**Recommendation:** When WEBULAR_SANDBOX=1, require an explicit output path or generate the default media download path inside WEBULAR_OUTPUT_DIR and pass it through safePath before writing. Add a sandbox test for media download without -o.

---

### Browser screenshot/PDF capture lacks output size and timeout enforcement

- **File:** `src/commands/media.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 18, 19, 30, 34
- **Slug:** other-resource-exhaustion
- **Confidence:** medium

The command allows screenshot/PDF actions for attacker-influenced URLs and forwards execution to the media workflow. Downstream, browserCapture invokes agent-browser without a timeout or byte cap and then reads the entire generated file with Bun.file(dest).arrayBuffer() just to calculate its size. A hostile page can hang capture or generate a very large screenshot/PDF, consuming worker time, disk, and memory despite the --max-bytes guard existing for downloads.

**Recommendation:** Apply an explicit timeout to browser capture, enforce a maximum output size for screenshot/PDF actions, and use file stat/Blob size instead of arrayBuffer() for byte counting. Delete over-limit outputs before returning.

---

### agent-browser screenshot path bypasses opt-in sandboxing

- **File:** `src/lib/agentbrowser.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 24, 25
- **Slug:** path-traversal
- **Confidence:** high

runBatch forwards structured commands directly to agent-browser via JSON stdin. That prevents shell/argument injection, but file-writing browser commands still trust their path arguments. The traced act flow takes --screenshot from src/commands/act.ts without safePath, adds ['screenshot', inputData.screenshot] in src/workflows/act.ts, and reaches this sink unchanged. With WEBULAR_SANDBOX=1, an untrusted automation caller can still supply an absolute or ../ screenshot path and cause agent-browser to write outside WEBULAR_OUTPUT_DIR, bypassing the project’s documented sandbox confinement.

**Recommendation:** Apply safePath to act screenshot destinations before building the batch command, and add a sandbox regression test for act --screenshot. Consider central validation in runBatch for file-writing commands so future agent-browser callers cannot bypass confinement.

---

### Unbounded agent-browser output can exhaust memory or hang the CLI

- **File:** `src/lib/agentbrowser.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 24, 29, 30, 31
- **Slug:** other-resource-exhaustion
- **Confidence:** medium

runBatch reads the child process stdout and stderr fully into strings with Response(...).text() and awaits proc.exited without any timeout or output cap. act always requests a browser snapshot, and attacker-controlled web content can produce very large browser/snapshot output or stall browser automation, causing the local CLI process to consume unbounded memory or remain blocked.

**Recommendation:** Read subprocess streams with explicit byte caps, fail closed on oversized output, and run agent-browser with a timeout/abort path. If large snapshots are expected, stream to a capped temp file instead of buffering whole stdout/stderr in memory.

---

### Browser capture ignores byte limits and buffers output in memory

- **File:** `src/workflows/media.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 13, 30, 41, 44
- **Slug:** other-resource-exhaustion
- **Confidence:** medium

`mediaInput` accepts `maxBytes`, but the limit is only passed to `downloadToFile` for `action === 'download'`. For `screenshot` and `pdf`, the workflow calls `browserCapture` without the limit; `browserCapture` runs `agent-browser` against the user-controlled URL and destination, then reads the entire generated file with `Bun.file(dest).arrayBuffer()` just to count bytes. A hostile page rendered as PDF, or another very large capture, can force the CLI or an automation worker to write a large file and then allocate the full file in memory even when `--max-bytes` was supplied.

**Recommendation:** Apply the byte limit to screenshot/PDF captures as well. Capture to a temporary file, use filesystem stat instead of `arrayBuffer()` to count bytes, delete oversized output, and only rename/move it to the requested destination after it passes the limit. Add capture timeouts or size constraints where `agent-browser` supports them.

---

## BUG (1)

### Sandboxed monitor mode rejects its default database path

- **File:** `src/commands/monitor.ts`
- **Recent committers:** Kiren Srinivasan <kiren@fantasymetals.com>
- **Lines:** 19, 32
- **Slug:** other-logic-bug
- **Confidence:** high

When no --db flag or WEBULAR_DB environment variable is supplied, resolveDbPath returns join(tmpdir(), 'webular-monitor.db'), which is an absolute path. main immediately passes that value to safePath. In WEBULAR_SANDBOX=1 mode, safePath rejects absolute paths, so the monitor command fails closed by default instead of using a sandbox-contained database. This is not a security bypass, but it breaks the intended sandboxed automation path unless callers know to provide a relative database path.

**Recommendation:** Use a relative default database path when sandboxing is enabled, or explicitly place the default under WEBULAR_OUTPUT_DIR before applying safePath.

---

