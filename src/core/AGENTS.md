# src/core/AGENTS.md

Rules for the shared Effect services, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- Process edge: [effect](effect.ts) (typed CLI failures and exit codes), [args](args.ts) (flag parsing), [output](output.ts) (stdout, stderr, and the `-o` file).
- Fetching: [http](http.ts) runs requests, [http-body](http-body.ts) reads bodies, [decode](decode.ts) turns bytes into text, [gunzip](gunzip.ts) inflates gzip sitemaps, [cache](cache.ts) is the disk cache, [archive](archive.ts) is the Wayback fallback.
- Policy: [fetch-policy](fetch-policy.ts) holds the retry, redirect, and failure rules. [budget](budget.ts) sizes fan-out from the host's real limits.
- Scope and safety: [url](url.ts) is the one place that sets URL identity and host scope. [safepath](safepath.ts) confines paths when `WEBULAR_SANDBOX=1`.
- Host: [proc](proc.ts) runs subprocesses, [root](root.ts) finds the package root, [platform](platform.ts) picks the executable that fits the machine.
- Small helpers: [auth-headers](auth-headers.ts), [capped-bytes](capped-bytes.ts), [feed-source](feed-source.ts), [retry-after](retry-after.ts), and [utc-date](utc-date.ts).

## Rules

- Bug classes here ([bug classes](../../docs/bug-classes.md)): fetch timeouts, body caps, shell-free child processes, URL keys, home paths. Guard tasks: `mise run bugs:security`, `bugs:parsing`, `bugs:os`.
- [`src/machines/fetch.ts`](../machines/fetch.ts) decides every retry, redirect, and failure. [http](http.ts) only performs what it asks. Change the rule in [fetch-policy](fetch-policy.ts), never in [http](http.ts).
- [url](url.ts) matches the exact host on purpose. Apex and `www` siblings are out of scope.
- Run subprocesses with argv arrays and a timeout. Never use a shell. Drain stdout and stderr together.
- A cache failure skips the cache and never fails a fetch.
- [platform](platform.ts) has one table of targets. Build, release, and the launcher all read it, so add a target there only.

### Resources

- Every remote call carries `AbortSignal.timeout`, merged with the caller's signal through `AbortSignal.any`. `Effect.tryPromise` passes its `AbortSignal` on to the API it wraps. Source: [Bun fetch docs](https://bun.com/docs/runtime/networking/fetch).
- Retry only GET requests on 408, 429, 502, 503, or 504, and never retry a timeout. Parse `Retry-After` as delta-seconds or an HTTP-date. Source: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110).
- Retry backoff uses capped full jitter. Keep one retry layer per call path, so attempts never multiply. Source: [AWS jitter guide](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter).
- Size fan-out from the granted capacity (the unified cgroup files `cpu.max` and `memory.max`), not from the CPUs the process can see. Source: [cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html).
- Bound the disk cache by bytes and entries, with sha256 keys and atomic temp-then-rename writes. Eviction also removes stray `.tmp` files. Revalidate with `If-None-Match` and `If-Modified-Since`, skip storing `no-store` responses, and serve a fresh `max-age` hit without a request. Source: [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111).
- Run each child process in a scope that kills it when the scope closes, and cap the bytes kept. After SIGTERM, escalate to SIGKILL after a grace period. Source: [Bun spawn docs](https://bun.com/docs/api/spawn).
- Disable tracing on hot HTTP paths with `TracerDisabledWhen`. Read settings through typed `Config` with clamped units, and keep secrets in `Redacted`. Use `Bun.CryptoHasher` for digests.

## Checks

- `mise run bugs:security` checks that fetch error text hides key-like query parameters.
- URL identity, charset labels, and `Retry-After` dates have parsing guards in `mise run bugs:parsing`.
- `src/core/output.ts:127` and `src/core/args.ts:85` write with `process.stdout.write`, which breaks JSON-RPC-only stdout for `webular mcp`.

```bash
mise run test:file tests/core tests/machines/fetch.test.ts tests/machines/policy.test.ts
```
