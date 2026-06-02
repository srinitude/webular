# Security — deepsec audit

webular's composed tools/workflows are audited with
[`deepsec`](https://github.com/vercel/deepsec). The committed reports are a
**fresh full scan** (re-initialised mirror) of the current codebase:

- [`deepsec-report.md`](./deepsec-report.md) · [`deepsec-report.json`](./deepsec-report.json)

## Definitive scan

| Severity | Count |
|----------|------:|
| CRITICAL | 1 |
| HIGH | 0 |
| MEDIUM | 6 |
| BUG | 1 |

**8 findings — down from 26** in the first scan. The first scan's 4 correctness
bugs and ~18 "unrestricted path" mediums no longer surface: the bugs are fixed
and the path class is documented as by-design in the scan's `INFO.md`.

**All 8 findings in the report are fixed in `HEAD`** (the report is the scan of
the parent commit):

| Sev | Finding | Fix |
|---|---|---|
| **CRITICAL** | sitemap discovery follows off-host sitemap-index URLs (SSRF) | `map` dropped sitemapper recursion — fetches `sitemap.xml` via host-scoped `fetchTextWithinHost`, parses `<loc>`, keeps only same-host URLs |
| MEDIUM | sitemap fetch bypassed the capped helper | same rewrite (host-scoped + 25 MB cap) |
| MEDIUM | sandboxed media download could escape via the temp path | `media` requires `-o` when `WEBULAR_SANDBOX=1` |
| MEDIUM | act/agent-browser screenshot path bypassed the sandbox | `act` now `safePath`s the screenshot destination |
| MEDIUM | agent-browser output unbounded / could hang | `runBatch` has a 60 s timeout; capture output capped at 50 MB |
| MEDIUM | browser capture buffered the whole file into memory | uses `Bun.file(dest).size` (no read) |
| BUG | sandboxed monitor rejected its own default DB path | `monitor` uses a base-relative default DB under sandbox |

## Accepted by design

The "unrestricted `-o`/`--file`/`--db` path" class and "fetches a user URL"
(SSRF) are intentional for a local single-user CLI (like `cp`/`curl -o`).
Opt-in **`WEBULAR_SANDBOX=1`** confines those paths via `safePath`
(realpath-canonicalised: rejects absolute, `..`, and symlinked-parent escapes).
`Bun.spawn([...])` arrays, structured agent-browser argv, and
`randomUUID`/`sha256` (run-ids / change-detection) are non-issues.

## Earlier rounds (already fixed)

- **4 correctness bugs**: diagram hard-coded path, diagram silent-fail, snapshot
  atomicity, tasks exit-check.
- **Hardening A/B**: SHA-pinned GitHub Actions, structured agent-browser argv,
  crawl redirect revalidation, download/fetch byte caps, opt-in sandbox mode.
- **Re-scan follow-up**: sandbox symlinked-parent bypass (realpath), unbounded
  text fetch, download temp-file + rename.

## Re-running / mirror note

deepsec re-investigates against a per-file mirror that only refreshes when its
regex matchers re-fire, so an in-place re-scan re-reports already-fixed issues
from stale snapshots. For a clean confirmation, re-init the workspace:

```bash
rm -rf .deepsec && bunx deepsec init      # then recreate data/webular/INFO.md
cd .deepsec && bun install
bunx deepsec scan && bunx deepsec process --agent codex && bunx deepsec report
```
