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

## Recommended hardening (defense-in-depth follow-ups)

Low-priority given the threat model above; tracked for future work:

- Pin GitHub Actions to commit SHAs (`actions/checkout`, `jdx/mise-action`).
- `agent-browser`: switch `runBatch` to structured argv / JSON-batch form
  (inputs are already `z.string().url()`-validated, so risk is low today).
- `crawl`: revalidate redirect targets against the same-host scope.
- `download` / `batch`: enforce a max-bytes cap and concurrency/URL ceilings.

## Re-running the audit

```bash
cd .deepsec
bunx deepsec process --agent codex   # or --agent claude with a valid API key
bunx deepsec report
```

The `.deepsec/` workspace is gitignored; only the exported reports here are
tracked. `webular audit --plan` prints the scan plan from the CLI itself.
