# Security — deepsec audit

webular's composed tools/workflows are audited with
[`deepsec`](https://github.com/vercel/deepsec) (agent-powered vulnerability
scanner). The latest machine-readable + markdown reports are committed here:

- [`deepsec-report.md`](./deepsec-report.md) · [`deepsec-report.json`](./deepsec-report.json)

## Latest run (2026-06-02, codex agent / gpt-5.5)

| Severity | Count |
|----------|------:|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 22 |
| BUG | 4 |

33 files analyzed. No critical or high-severity vulnerabilities.

## Fixed in this commit (the 4 BUG findings)

- **diagram hard-coded path** → `DIAGRAMS_DIR` now resolves via
  `import.meta.url` so `webular diagram` works when npm-installed.
- **diagram silent failure** → `renderOne` checks the `mmdc` exit code and
  throws on failure (no more false "rendered").
- **tasks ignores mise failure** → `tasks` checks the `mise` exit code and
  throws on nonzero.
- **snapshot non-atomic** → `compareAndStore` runs the read/compare/write in a
  single `BEGIN IMMEDIATE` transaction (`db.transaction(...).immediate()`).

## Accepted by design (the 22 MEDIUM findings)

All 22 MEDIUM findings are the **same class** — "unrestricted `--output` /
`--db` / `--file` path" and "fetches a user-supplied URL" — and every one is
qualified *"if an automating caller passes attacker-controlled flags."*

webular is a **local, single-user CLI** that runs with the invoking user's own
privileges and **no auth boundary**. Writing output where the user points
(`-o`), reading the file the user names (`parse --file`), using the DB path the
user chooses (`monitor --db`), and fetching the URL the user requests are the
tool's **intended behavior** — exactly like `cp`, `curl -o`, or `wget`.
Constraining these to a sandbox directory would break legitimate use (and the
test suite, which writes to `os.tmpdir()` absolute paths). SSRF to arbitrary
URLs is the **product**, not a defect.

**Embedder guidance:** if you wrap webular in automation that forwards
*untrusted* flags/URLs to it, run it in a sandbox (container, seccomp, a
dedicated output dir, network egress controls) and validate the flags you pass.

## Hardening applied (defense-in-depth, follow-up round)

The actionable MEDIUM findings have since been addressed:

- **CI supply chain** — `actions/checkout` and `jdx/mise-action` are pinned to
  full commit SHAs (with `# vN` comments) in `.github/workflows/ci.yml`.
- **agent-browser argument injection** — `runBatch` now sends **structured
  argv** via agent-browser's JSON stdin batch (`[["open", url], …]`), so URL /
  path values stay atomic (no re-tokenization).
- **crawl redirect SSRF** — scoped crawls use `fetchTextWithinHost` (manual
  `redirect: 'manual'`, revalidating each hop's host against the root).
- **download DoS** — `downloadToFile` rejects oversized `Content-Length`,
  streams to disk with a byte cap (`--max-bytes`), and uses a random temp name.
- **batch resource exhaustion** — concurrency clamped to ≤32 and URL count
  capped at 1000 (rejected at both the CLI and the zod schema).

## Opt-in sandbox mode (for untrusted-automation embedders)

The "unrestricted path" class can be locked down without changing default UX:
set **`WEBULAR_SANDBOX=1`** (optionally `WEBULAR_OUTPUT_DIR`) and all `-o`,
`parse --file`, `monitor --db`, and `media` destination paths are confined to
the base directory — absolute paths, `..` traversal, and symlink targets are
rejected (`src/core/safepath.ts`). Off by default, so normal CLI use is
unaffected.

## Re-scan follow-up

A forced full re-investigation (`deepsec process --reinvestigate`) surfaced
three issues in the hardening code itself, now fixed:

- **HIGH — sandbox symlinked-parent bypass** (`safepath.ts`): now canonicalizes
  the deepest existing ancestor with `realpath`, so a symlinked parent directory
  can no longer escape the base. Covered by a contract test.
- **BUG — unbounded text fetch** (`http.ts`): `fetchText` now reads through a
  25 MB streamed byte cap (rejects oversized/chunked responses).
- **BUG — partial file on cap-exceed** (`download.ts`): downloads stream to a
  temp file and `rename` on success; the temp is removed on failure, so the
  destination is never left truncated.

Note: deepsec re-investigates against a per-file mirror that only refreshes when
its regex matchers re-fire, so the committed report above still lists the
already-fixed `diagram`/`tasks`/`snapshot` bugs from a **stale mirror** (its
text even claims `DIAGRAMS_DIR is fixed to /Users/...`, which the current code
no longer does — it uses `import.meta.url`). A pristine re-confirm requires
re-initialising the `.deepsec` workspace so the mirror is rebuilt from current
code.

## Re-running the audit

```bash
cd .deepsec
bunx deepsec process --agent codex   # or --agent claude with a valid API key
bunx deepsec report
```

The `.deepsec/` workspace is gitignored; only the exported reports here are
tracked. `webular audit --plan` prints the scan plan from the CLI itself.
