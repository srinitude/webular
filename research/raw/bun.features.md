# Bun Web-Related Features Catalog
## For: webular CLI (web scrape/research/crawl/map/extract/summarize/context tool)

**Source:** Deep-read of Bun documentation, June 2026  
**Coverage:** 30 deep-read pages out of 320 total URLs cataloged  
**Scope:** Web/networking primitives that webular will BUILD WITH

---

## 1. HTTP Server — `Bun.serve()`

**Purpose:** High-performance HTTP server (uWebSockets-based, ~2.5x faster than Node.js). The primary server primitive webular uses to expose scrape/research APIs.

**Key Parameters:**
- `routes`: object mapping URL patterns to handlers (static paths, `:params`, `*` wildcards)
- `fetch(req, server)`: fallback handler for unmatched routes
- `port` / `hostname` / `unix`: bind configuration
- `tls`: TLS config object (key, cert, ca, passphrase, dhParamsFile, serverName)
- `http3: true`: experimental HTTP/3 over QUIC (requires TLS)
- `http1: false`: HTTP/3-only mode
- `idleTimeout`: seconds before idle connection closes (default 10, max 255, 0=off)
- `development: boolean | {hmr, console}`: dev mode with HMR, sourcemaps, error pages
- `websocket`: WebSocket handler configuration
- `error(error)`: error callback returning Response

**Server Instance Methods:**
- `server.stop(closeActive?)`: graceful/force stop
- `server.reload(options)`: hot-swap fetch/error/routes handlers without restart
- `server.upgrade(req, {headers?, data?})`: upgrade HTTP to WebSocket
- `server.publish(topic, data, compress?)`: broadcast to WebSocket subscribers
- `server.subscriberCount(topic)`: count WebSocket subscribers
- `server.requestIP(req)`: get client SocketAddress (address, port, family)
- `server.timeout(req, seconds)`: per-request idle timeout override
- `server.ref()` / `server.unref()`: process lifetime control
- `server.pendingRequests` / `server.pendingWebSockets`: live metrics

**FOSS Candidates (for webular's own HTTP layer):**
- `express` / `fastify` / `hono` (npm) — Node-compatible HTTP frameworks
- `uWebSockets.js` (npm) — same underlying engine Bun uses
- `node:http` — built-in, Bun-compatible

---

## 2. HTTP Routing

**Purpose:** Tree-based SIMD-accelerated router built into `Bun.serve()`. Routes requests to handlers with type-safe params.

**Key Parameters:**
- Static routes: `"/path": new Response(...)` or `"/path": handler`
- Parameter routes: `"/users/:id"` — `req.params.id` auto-decoded (percent-encoding, Unicode)
- Wildcard routes: `"/api/*"` — catch-all with lowest priority
- Per-method: `"/api/posts": { GET: handler, POST: handler }`
- Static Response optimization: zero-allocation dispatch, ETag + If-None-Match for static
- File routes: `new Response(Bun.file(path))` — Last-Modified, Range requests, streaming
- `server.reload(options)`: hot-swap routes at runtime

**FOSS Candidates:**
- `path-to-regexp` (npm) — route parameter parsing
- `find-my-way` (npm) — Radix/trie router used by Fastify
- `hono` (npm) — ultrafast Bun-native router

---

## 3. WebSockets (Server + Client)

**Purpose:** Native WebSocket server (7x faster than Node ws library) and client. Essential for webular's real-time result streaming and live crawl progress.

**Server Handler Parameters (in `Bun.serve({ websocket: {...} })`):**
- `message(ws, message)`: required — receive message (string | Buffer)
- `open(ws)`: connection opened
- `close(ws, code, reason)`: connection closed
- `drain(ws)`: backpressure relieved
- `error(ws, error)`: error handler
- `ping(ws, data)` / `pong(ws, data)`: ping/pong frames
- `maxPayloadLength`: default 16 MB
- `idleTimeout`: default 120 seconds
- `backpressureLimit`: default 1 MB
- `closeOnBackpressureLimit`: default false
- `sendPings`: default true
- `publishToSelf`: default false
- `perMessageDeflate`: boolean or `{compress, decompress}` with Compressor variants

**ServerWebSocket Methods:**
- `ws.send(data, compress?)`: returns -1 (backpressure), 0 (dropped), or bytes sent
- `ws.close(code?, reason?)`: close connection
- `ws.subscribe(topic)` / `ws.unsubscribe(topic)` / `ws.publish(topic, data)`: pub/sub
- `ws.isSubscribed(topic)`: check subscription
- `ws.cork(cb)`: batch writes
- `ws.data`: attached contextual data (typed via `data` property)
- `ws.remoteAddress`: client IP
- `ws.subscriptions`: list of subscribed topics

**Client (`new WebSocket(url, protocols?)`):**
- Bun extension: pass `{headers: {...}}` as second argument
- Standard `addEventListener(message/open/close/error)`

**FOSS Candidates:**
- `ws` (npm) — Node.js WebSocket library
- `socket.io` (npm) — higher-level WebSocket + fallback
- `uWebSockets.js` (npm) — same engine

---

## 4. Fetch API (HTTP Client)

**Purpose:** WHATWG-compliant fetch with Bun extensions. The primary HTTP client primitive for webular's scraping/crawling engine.

**Key Parameters:**
- `url`: string, Request object, file://, data:, blob:, s3:// protocols
- `method`: HTTP verb
- `headers`: object or Headers instance
- `body`: string, FormData, ArrayBuffer, Blob, ReadableStream
- `signal`: AbortSignal (use `AbortSignal.timeout(ms)` for timeouts)
- `proxy`: URL string or `{url, headers}` object (CONNECT proxy with custom auth headers)
- `unix`: path to Unix domain socket for local daemon communication
- `tls`: `{key, cert, ca, rejectUnauthorized, checkServerIdentity}`
- `decompress`: boolean (default true) — auto-decompress gzip/deflate/brotli/zstd
- `keepalive`: boolean — disable connection reuse per-request
- `verbose`: boolean or "curl" — debug logging of request/response headers
- `s3`: S3 credentials object for s3:// URLs

**Response Methods:**
- `response.text()`, `response.json()`, `response.formData()`, `response.bytes()`, `response.arrayBuffer()`, `response.blob()`
- `response.body`: ReadableStream for streaming (`for await...of`)

**Performance Extensions:**
- `fetch.preconnect(url)`: warm up TCP+TLS before request needed
- `dns.prefetch(hostname, port)`: pre-resolve DNS
- `BUN_CONFIG_MAX_HTTP_REQUESTS=N`: increase simultaneous connection limit (default 256)
- Connection pooling: automatic HTTP keep-alive and connection reuse
- `sendfile(2)` syscall for large file uploads (HTTP only, >32KB)

**Protocol Extensions:**
- `s3://bucket/path`: S3-compatible object storage
- `file:///path`: local filesystem
- `data:`: data URLs
- `blob:`: object URLs

**FOSS Candidates:**
- `undici` (npm) — Node.js HTTP/1.1 client (also fetch-compatible)
- `got` (npm) — feature-rich Node HTTP client
- `axios` (npm) — widely-used HTTP client with interceptors
- `node-fetch` (npm) — fetch polyfill for Node
- `curl` via `Bun.spawn` — raw HTTP/HTTPS/proxy access

---

## 5. HTMLRewriter

**Purpose:** CSS-selector-driven streaming HTML transformation based on Cloudflare's lol-html. The key webular primitive for HTML parsing, link extraction, content cleaning, and metadata extraction.

**Key API:**
- `new HTMLRewriter().on(selector, handlers)`: register element handlers
- `rewriter.onDocument(handlers)`: document-level events (doctype, text, comments, end)
- `rewriter.transform(input)`: transform Response, string, ArrayBuffer, Blob, or BunFile

**Selector Support:** Tag, class (`.foo`), ID (`#bar`), attribute selectors (`[data-x]`, `[data-x="v"]`, `[data-x~="v"]`, `^=`, `$=`, `*=`, `|=`), combinators (descendant `div span`, child `div > span`), pseudo-classes (`:nth-child()`, `:first-child`, `:nth-of-type()`, `:not()`), universal (`*`)

**Element Handler Methods:**
- `el.getAttribute(name)` / `el.setAttribute(name, value)` / `el.hasAttribute(name)` / `el.removeAttribute(name)`
- `el.setInnerContent(content, {html?})`: replace inner HTML or text
- `el.before(content, {html?})` / `el.after(...)` / `el.prepend(...)` / `el.append(...)`
- `el.remove()` / `el.removeAndKeepContent()`
- `el.onEndTag(cb)`: handle closing tag
- `el.tagName`, `el.namespaceURI`, `el.selfClosing`, `el.canHaveContent`, `el.removed`
- Iterate attributes: `for (const [name, value] of el.attributes)`

**Text Handler Methods:**
- `text.text`, `text.lastInTextNode`, `text.removed`
- `text.before/after/replace/remove` (with `{html?}`)

**Comment Handler:** `comment.text` (get/set), `comment.before/after/replace/remove`

**Document Handler:** `doctype.name/publicId/systemId`, document `end.append()`

**Async handlers supported** (block transformation until resolved)

**FOSS Candidates (for HTML parsing/transformation):**
- `cheerio` (npm) — jQuery-style HTML parser/selector
- `@mozilla/readability` (npm) — article extraction (removes nav/ads)
- `node-html-parser` (npm) — fast lightweight HTML parser
- `linkedom` (npm) — DOM implementation for server
- `htmlparser2` (npm) — streaming HTML parser
- `turndown` (npm) — HTML to Markdown conversion
- `rehype` (npm) — HTML processing pipeline
- `lol-html` (npm/wasm) — exact same engine as Bun's HTMLRewriter

---

## 6. Server-Sent Events (SSE)

**Purpose:** Push streaming text events to browser/client over a single HTTP response. Essential for webular's live progress/result streaming.

**Pattern 1 — Async Generator:**
```ts
new Response(async function* () {
  yield `data: connected\n\n`;
  while (true) {
    await Bun.sleep(5000);
    yield `data: tick ${Date.now()}\n\n`;
  }
}, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } })
```

**Pattern 2 — ReadableStream:**
```ts
new ReadableStream({
  start(controller) { controller.enqueue("data: hello\n\n"); timer = setInterval(...) },
  cancel() { clearInterval(timer); }
})
```

**Key Note:** Use `server.timeout(req, 0)` to disable 10-second idle timeout for SSE connections.

**FOSS Candidates:**
- `eventsource-parser` (npm) — SSE client-side parser
- `@microsoft/fetch-event-source` (npm) — SSE over fetch with reconnection
- `sse` (npm) — basic SSE helper
- Server-side: handled natively with `ReadableStream` + `Content-Type: text/event-stream`

---

## 7. TLS Support

**Purpose:** BoringSSL-powered TLS for HTTPS servers and mutual TLS clients.

**Server TLS Parameters (`Bun.serve({ tls: {...} })`):**
- `key`: private key — string, BunFile, TypedArray, Buffer, or array thereof
- `cert`: certificate — same types as key
- `ca`: CA bundle — same types (overrides Mozilla's default CA list)
- `passphrase`: decrypt encrypted private key
- `dhParamsFile`: path to DH parameters file
- `serverName`: SNI hostname
- Multi-domain: pass array of `{key, cert, serverName}` objects

**Client TLS (in `fetch` `tls` option):**
- `key`, `cert`, `ca`: mutual TLS client certificate
- `rejectUnauthorized`: false to disable validation (self-signed certs)
- `checkServerIdentity(hostname, peerCertificate)`: custom validation callback

**FOSS Candidates:**
- `node:tls` — built-in Node.js TLS (Bun-compatible)
- `devcert` (npm) — auto-generate local dev TLS certificates
- `mkcert` (CLI) — create locally-trusted dev certificates

---

## 8. Cookies (HTTP)

**Purpose:** Built-in cookie management on `BunRequest`. Auto-applies modified cookies to response headers.

**Key API:**
- `req.cookies.get(name)`: read cookie value (CookieMap)
- `req.cookies.set(name, value, options?)`: set cookie; auto-applied to response
  - Options: `maxAge`, `httpOnly`, `secure`, `path`, `sameSite`, `domain`, `expires`
- `req.cookies.delete(name, options?)`: delete (sets maxAge=0 with empty value)
- Works only in routes (not `fetch` fallback handler)
- `new Bun.CookieMap(cookieHeader)`: standalone cookie parsing

**FOSS Candidates:**
- `cookie` (npm) — RFC 6265 cookie parsing/serialization
- `tough-cookie` (npm) — full cookie jar implementation with RFC compliance
- `js-cookie` (npm) — simple cookie library

---

## 9. CSRF Protection

**Purpose:** Built-in HMAC-signed CSRF token generation and verification. Webular can use for any server-side form/API protection.

**Key API:**
- `Bun.CSRF.generate(secret?, options?)`: returns encoded token
  - `expiresIn`: ms until expiry (default 86400000 = 24h)
  - `encoding`: "base64" | "base64url" | "hex" (default "base64url")
  - `algorithm`: "sha256" | "sha384" | "sha512" | "sha512-256" | "blake2b256" | "blake2b512"
  - `sessionId`: bind token to specific user/session
- `Bun.CSRF.verify(token, options?)`: returns boolean
  - `secret`, `maxAge`, `encoding`, `algorithm`, `sessionId`

**FOSS Candidates:**
- `csrf` (npm) — CSRF token library
- `csurf` (npm) — Express middleware for CSRF
- `crypto.createHmac` — Node.js built-in HMAC (Bun-compatible)

---

## 10. TCP Sockets — `Bun.listen()` / `Bun.connect()`

**Purpose:** Low-level TCP server and client. Useful for webular's proxy support or custom protocol implementation.

**Server (`Bun.listen(options)`):**
- `hostname`, `port`, `unix`: bind address
- `socket.data(socket, data)`: receive data
- `socket.open(socket)`: connection opened
- `socket.close(socket, error)`: connection closed
- `socket.drain(socket)`: socket ready for more data
- `socket.error(socket, error)`: error handler
- `tls`: `{key, cert}` for TLS
- `server.stop(true/false)`: stop listening
- `server.reload({socket})`: hot-reload handlers
- Contextual data: `socket.data` property

**Client (`Bun.connect(options)`):**
- Additional handlers: `connectError`, `end` (server closed), `timeout`
- `tls: true` for TLS
- Socket write: `socket.write(data)` — no internal buffering; use `ArrayBufferSink({stream:true})`

**FOSS Candidates:**
- `node:net` — built-in TCP (Bun-compatible)
- `node:tls` — built-in TLS sockets (Bun-compatible)

---

## 11. UDP Sockets — `Bun.udpSocket()`

**Purpose:** Low-level UDP for high-performance real-time protocols, DNS queries, etc.

**Key API:**
- `await Bun.udpSocket({port?, socket?, connect?})`: bind socket
- `socket.send(data, port, addr)`: send datagram (IP only, no DNS)
- `socket.sendMany([data, port, addr, ...])`: batch send; returns sent count
- `socket.data` callback: `(socket, buf, port, addr) => {}`
- `socket.drain`: called when socket writable again after backpressure
- Connect to peer: `socket = await Bun.udpSocket({connect: {port, hostname}})`
- `socket.setBroadcast(true)` / `socket.setTTL(n)`
- Multicast: `socket.addMembership(group, iface?)`, `socket.dropMembership()`, `socket.setMulticastTTL()`, `socket.setMulticastLoopback()`, `socket.setMulticastInterface()`
- SSM: `socket.addSourceSpecificMembership(source, group)`

**FOSS Candidates:**
- `node:dgram` — built-in UDP (Bun-compatible)

---

## 12. DNS — `dns.prefetch()` / `dns.getCacheStats()`

**Purpose:** DNS resolution with caching (up to 255 entries, 30s TTL) and prefetching. Webular uses this to pre-warm DNS for crawl targets.

**Key API:**
- `import { dns } from "bun"` — Bun-specific DNS module
- `dns.prefetch(hostname, port)`: pre-resolve DNS (async, no return)
- `dns.getCacheStats()`: `{cacheHitsCompleted, cacheHitsInflight, cacheMisses, size, errors, totalCount}`
- `BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS=N`: configure cache TTL
- `import * as dns from "node:dns"` — Node.js-compatible DNS
- `dns.promises.resolve4(hostname, {ttl?})`: resolve IPv4

**Auto-used by:** `bun install`, `fetch()`, `node:http` (client), `Bun.connect`, `node:net`, `node:tls`

**FOSS Candidates:**
- `node:dns` — built-in (Bun-compatible)
- `dns-packet` (npm) — DNS packet encoding/decoding
- `got` (npm) — includes DNS resolution with caching

---

## 13. S3 Object Storage — `Bun.s3` / `Bun.S3Client`

**Purpose:** Native S3-compatible object storage client. Webular can use for crawl artifact storage, cache, or output persistence.

**Key API:**
- `Bun.s3` = `new Bun.S3Client()` (reads env: `S3_*` or `AWS_*`)
- `new S3Client({accessKeyId, secretAccessKey, bucket, region?, endpoint?, sessionToken?, acl?, virtualHostedStyle?})`
- `client.file(path)`: returns lazy `S3File` (no network until method called)

**S3File (extends Blob) Methods:**
- `s3file.text()`, `s3file.json()`, `s3file.bytes()`, `s3file.arrayBuffer()`, `s3file.stream()`
- `s3file.slice(start, end)`: partial read (uses HTTP Range header)
- `s3file.write(data, options?)`: upload (string/Uint8Array/ArrayBuffer/Blob/ReadableStream/Response)
- `s3file.writer({retry?, queueSize?, partSize?})`: streaming multipart upload
- `s3file.exists()`: check existence
- `s3file.delete()` / `s3file.unlink()`: delete
- `s3file.presign(options?)`: signed URL (synchronous, no network)
  - `method`: GET/PUT/DELETE/HEAD/POST
  - `expiresIn`: seconds
  - `acl`: "public-read" | "private" | "public-read-write" | etc.
  - `contentDisposition`, `type`
- `s3file.stat()`: `{etag, lastModified, size, type}`
- `new Response(s3file)`: auto-redirects to presigned URL (302)

**Static Methods:** `S3Client.write()`, `S3Client.presign()`, `S3Client.list({prefix?, maxKeys?, fetchOwner?, startAfter?})`, `S3Client.exists()`, `S3Client.size()`, `S3Client.stat()`, `S3Client.delete()`

**Supported services:** AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, Backblaze B2, Google Cloud Storage (via endpoint), Supabase

**Protocol:** `s3://bucket/path` works in both `fetch()` and `Bun.file()`

**FOSS Candidates:**
- `@aws-sdk/client-s3` (npm) — official AWS SDK
- `minio` (npm) — MinIO S3 client (also works with AWS S3)
- `s3-lite-client` (npm) — lightweight S3 client
- Local dev: MinIO (Docker) as S3-compatible server

---

## 14. Redis Client — `Bun.redis` / `Bun.RedisClient`

**Purpose:** Native Redis client with auto-pipelining and Pub/Sub. Webular can use for crawl queue, rate limiting, caching.

**Key API:**
- `Bun.redis` = `new RedisClient()` (reads `REDIS_URL` or `VALKEY_URL`, defaults to `redis://localhost:6379`)
- `new RedisClient(url, options?)`
  - `connectionTimeout`: ms (default 10000)
  - `idleTimeout`: ms (default 0)
  - `autoReconnect`: boolean (default true)
  - `maxRetries`: number (default 10)
  - `enableOfflineQueue`: boolean (default true)
  - `enableAutoPipelining`: boolean (default true)
  - `tls`: boolean or `{rejectUnauthorized, ca, cert, key}`

**String/Key Operations:**
- `redis.set(key, value)`, `redis.get(key)`, `redis.del(key)`, `redis.exists(key)`
- `redis.expire(key, seconds)`, `redis.ttl(key)`
- `redis.incr(key)`, `redis.decr(key)`
- `redis.getBuffer(key)`: returns Uint8Array

**Hash Operations:** `redis.hget/hset/hmget/hmset/hincrby/hincrbyfloat`

**Set Operations:** `redis.sadd/srem/sismember/smembers/srandmember/spop`

**Pub/Sub:** `redis.publish(channel, message)`, `redis.subscribe(channel, callback)`, `redis.unsubscribe(channel?, callback?)`

**Raw Command:** `redis.send(command, args[])` — any Redis command

**Connection:** `client.connect()`, `client.close()`, `client.duplicate()`, `client.onconnect`, `client.onclose`, `client.connected`, `client.bufferedAmount`

**URL Formats:** `redis://`, `rediss://` (TLS), `redis+tls://`, `redis+unix:///path/to.sock`, `redis+tls+unix:///`

**Limitations:** No transactions (MULTI/EXEC) via convenience methods (use `send`); no Sentinel/Cluster

**FOSS Candidates:**
- `ioredis` (npm) — full-featured Redis client for Node/Bun
- `redis` (npm) — official Node.js Redis client
- `@valkey/valkey-glide` (npm) — Valkey/Redis client

---

## 15. SQLite — `bun:sqlite`

**Purpose:** Embedded SQLite3 driver (3-6x faster than better-sqlite3). Webular's local persistence for crawl data, URL queues, and result caches.

**Key API:**
- `new Database(path?, {readonly?, create?, safeIntegers?, strict?})`
- `db.query(sql)`: returns cached prepared Statement
- `db.prepare(sql)`: fresh (uncached) Statement
- `db.run(sql, params?)`: execute without caching, returns `{lastInsertRowid, changes}`
- `db.transaction(fn)`: atomic wrapper; `.deferred()`, `.immediate()`, `.exclusive()` variants
- `db.close(throwOnError?)`: close connection
- `db.serialize()`: returns Uint8Array of DB bytes; `Database.deserialize(bytes)`: restore
- `db.loadExtension(name)`: load SQLite extensions
- `db.fileControl(cmd, value)`: low-level sqlite3_file_control
- `db.run("PRAGMA journal_mode = WAL;")`: enable WAL mode (recommended for performance)
- ES module import: `import db from "./mydb.sqlite" with { type: "sqlite" }`

**Statement Methods:**
- `stmt.all(params?)`: returns all rows as object[]
- `stmt.get(params?)`: returns first row or undefined
- `stmt.run(params?)`: execute, returns `{lastInsertRowid, changes}`
- `stmt.values(params?)`: returns rows as unknown[][]
- `stmt.iterate()`: lazy row iterator
- `stmt.as(Class)`: map rows to class instances without ORM overhead
- `stmt.finalize()`: free resources
- `stmt.toString()`: expanded SQL with bound params

**Parameters:** Named (`$name`, `:name`, `@name`) and positional (`?1`)

**Type Mapping:** string→TEXT, number→INTEGER/DECIMAL, boolean→INTEGER (0/1), Uint8Array/Buffer→BLOB, bigint→INTEGER, null→NULL

**FOSS Candidates:**
- `better-sqlite3` (npm) — synchronous SQLite for Node
- `drizzle-orm` + `bun:sqlite` (npm) — type-safe ORM for Bun SQLite
- `prisma` (npm) — full ORM supporting SQLite

---

## 16. SQL (PostgreSQL Native) — `bun:sql`

**Purpose:** Native PostgreSQL client (faster than pg/postgres.js). Webular's production database driver for large-scale crawl data storage.

**Key API (summary from page — full page exceeded token limit):**
- `import { sql } from "bun"` — tagged template literal query API
- Template literal queries: `` sql`SELECT * FROM users WHERE id = ${id}` ``
- Automatic parameterization prevents SQL injection
- Connection reads env: `DATABASE_URL`, `POSTGRES_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- Supports: transactions, prepared statements, connection pooling

**FOSS Candidates:**
- `postgres` (npm) — modern PostgreSQL client (similar template tag API)
- `pg` (npm) — classic Node.js PostgreSQL client
- `drizzle-orm` + `postgres` (npm) — type-safe ORM
- `prisma` (npm) — full ORM with Postgres support

---

## 17. Bundler Executables — `bun build --compile`

**Purpose:** Compile TypeScript/JS into a self-contained single-file executable with Bun runtime embedded. Use for distributing webular as a standalone CLI binary.

**Key CLI:**
```
bun build --compile --target=bun ./index.ts --outfile webular
```

**Key Parameters (summary — full page exceeded token limit):**
- `--compile`: embed Bun runtime into output
- `--target=bun`: target Bun runtime
- `--production`: minify + disable dev features
- `--outfile`: output binary path
- `--minify`: minify source (separate flags: `--minify-identifiers`, `--minify-whitespace`, `--minify-syntax`)
- Cross-compilation: `--target=bun-linux-x64`, `--target=bun-darwin-arm64`, etc.
- Embedded assets: files referenced via `import.meta.file` or `Bun.file` get bundled
- `--sourcemap`: embed/external/inline

**FOSS Candidates:**
- `pkg` (npm) — Node.js executable compiler
- `nexe` (npm) — Node.js to executable compiler
- `esbuild` (npm) — fast JS bundler (no compile, but minifies for distribution)

---

## 18. Fullstack Dev Server — `bundler/fullstack`

**Purpose:** HTML import + frontend bundling integrated directly into `Bun.serve()`. Webular can use for its web UI.

**Key API:**
- `import dashboard from "./dashboard.html"` — HTML file as route value
- `Bun.serve({ routes: { "/": homepage } })`: auto-bundles `<script>` and `<link>` tags
- Processing pipeline: HTMLRewriter scans HTML → Bun bundler transpiles TS/JSX/CSS → content-addressable URLs → serves optimized assets
- `development: { hmr: true, console: true }`: HMR via WebSocket + browser console forwarding
- `development: false`: in-memory caching, ETags, minification
- `bun build --target=bun --production --outdir=dist`: AOT production bundling
- `bunfig.toml [serve.static] plugins = [...]`: bundler plugins (e.g. `bun-plugin-tailwind`)
- `bunfig.toml [serve.static] env = "PUBLIC_*"`: inline env vars into frontend

**FOSS Candidates:**
- `vite` (npm) — fast HMR dev server + build tool
- `esbuild` (npm) — fast bundler (no HMR, manual serving)
- `parcel` (npm) — zero-config bundler
- `webpack` (npm) — full-featured bundler

---

## 19. Web Workers — `Worker`

**Purpose:** Multi-threaded JavaScript execution. Webular can parallelize crawl/scrape tasks across CPU cores.

**Key API:**
- `new Worker(url, options?)`: spawn worker thread
  - `preload: string | string[]`: modules to load before worker starts
  - `ref: false`: don't keep process alive
  - `smol: true`: lower memory footprint (smaller GC heap)
- `worker.postMessage(data)`: send to worker (string fast-path, simple-object fast-path = 2-241x faster than Node)
- `worker.onmessage` / `worker.addEventListener("message", ...)`: receive from worker
- `worker.terminate()`: force stop
- `worker.ref()` / `worker.unref()`: process lifetime
- Bun events: `"open"` (worker ready), `"close"` (worker terminated with exit code)
- `Bun.isMainThread`: check thread context
- `setEnvironmentData(key, value)` / `getEnvironmentData(key)`: share data across threads
- `process.on("worker", handler)`: listen for new worker creation
- Blob URLs: `new Worker(URL.createObjectURL(new Blob([code])))` — supports TypeScript

**FOSS Candidates:**
- `node:worker_threads` — built-in (Bun-compatible, used by Bun's Worker)
- `piscina` (npm) — worker thread pool
- `tinypool` (npm) — lightweight worker pool

---

## 20. Bun Shell — `$` Template Tag

**Purpose:** Cross-platform bash-like shell with JS interop. Webular uses for CLI automation, pipe composition, and tool invocation.

**Key API:**
- `import { $ } from "bun"`
- `` await $`command ${arg}` ``: execute command (args auto-escaped, injection-safe)
- Output methods: `.text()`, `.json()`, `.lines()`, `.blob()`, `.quiet()`
- Error handling: non-zero exit throws `ShellError` with `.exitCode`, `.stdout`, `.stderr`
- `.nothrow()`: don't throw on non-zero exit
- `.throws(bool)`: configure globally with `$.throws(bool)`
- Redirection: `<`, `>`, `2>`, `&>`, `>>`, `2>&1`, `1>&2`
- JS object I/O: `< ${response}` (stdin from Response/Buffer/Blob/BunFile), `> ${buffer}` (stdout to Buffer)
- Piping: `` $`cmd1 | cmd2` ``
- Command substitution: `$(cmd)` syntax
- Environment: `.env({...})`, `$.env({...})`, `.cwd(path)`, `$.cwd(path)`
- Brace expansion: `$.braces("echo {1,2,3}")` → `["echo 1", "echo 2", "echo 3"]`
- `$.escape(str)`: expose shell escaping logic
- Unescaped injection: `${{ raw: 'unsafe string' }}` — use with caution
- Built-in commands: `cd`, `ls`, `rm`, `echo`, `pwd`, `cat`, `touch`, `mkdir`, `which`, `mv`, `exit`, `true`, `false`, `yes`, `seq`, `dirname`, `basename`
- `.sh` file support: `bun ./script.sh` runs cross-platform

**FOSS Candidates:**
- `execa` (npm) — improved process execution with streams
- `zx` (npm) — Google's similar shell-scripting for Node (inspired Bun Shell)
- `dax` (npm) — Deno shell (also inspired Bun Shell)
- `shelljs` (npm) — portable Unix shell commands for Node

---

## 21. File I/O — `Bun.file()` / `Bun.write()`

**Purpose:** Optimized file reading and writing with zero-copy system calls. Webular's primitive for reading/writing crawl outputs.

**Key API:**
- `Bun.file(path | fd | URL, {type?})`: returns lazy `BunFile` (no disk read)
  - `bunfile.size`, `bunfile.type`
  - `await bunfile.text()`, `.json()`, `.arrayBuffer()`, `.bytes()`, `.stream()`
  - `bunfile.exists()`: check existence
  - `bunfile.delete()`: delete file
  - `bunfile.writer({highWaterMark?})`: returns `FileSink` for incremental writes
- `Bun.write(dest, data)`: write string/Blob/ArrayBuffer/TypedArray/Response to file
  - Uses optimal syscall: `copy_file_range` (Linux), `clonefile` (macOS), `sendfile`, `splice`
  - `await Bun.write("output.html", response)`: save HTTP response to disk
- `FileSink`: `write(chunk)`, `flush()`, `end(error?)`, `ref()`, `unref()`
- `Bun.stdin`, `Bun.stdout`, `Bun.stderr`: BunFile instances
- `node:fs/promises`: `readdir(path, {recursive?})`, `mkdir(path, {recursive?})`

**FOSS Candidates:**
- `node:fs` / `node:fs/promises` — built-in (Bun-compatible)
- `fs-extra` (npm) — extra file system methods
- `glob` (npm) — file globbing

---

## 22. Streams — `ReadableStream` / `WritableStream` / `Bun.ArrayBufferSink`

**Purpose:** Binary data streaming without full memory load. Core for webular's large page/file handling.

**Key API:**
- `new ReadableStream({type?, start(controller), pull(controller), cancel()})`: standard Web API
  - `type: "direct"`: zero-copy direct write (Bun-specific optimization)
  - Direct: `controller.write(data)` instead of `controller.enqueue(data)`
- Async generator streams: `new Response(async function*() { yield chunk; })`
- `for await (const chunk of stream)`: consume chunks
- `stream.tee()`: split into two independent streams
- `Bun.ArrayBufferSink`: fast incremental buffer builder
  - `.start({asUint8Array?, highWaterMark?, stream?})`
  - `.write(chunk)`, `.flush()`: returns accumulated buffer
  - `.end()`: returns final buffer
- `node:stream`: `Readable`, `Writable`, `Duplex` — Bun-compatible
- `Bun.readableStreamToArrayBuffer(stream)`, `Bun.readableStreamToBytes(stream)`, `Bun.readableStreamToText(stream)`, `Bun.readableStreamToArray(stream)`: optimized converters

**FOSS Candidates:**
- `web-streams-polyfill` (npm) — Web Streams API polyfill
- `node:stream` — built-in Node streams (Bun-compatible)
- `readable-stream` (npm) — Node.js stream library backport

---

## 23. Binary Data — TypedArray / Buffer / Blob / DataView

**Purpose:** Binary data manipulation without string overhead. Webular uses for raw HTML/response processing.

**Key Types:**
- `ArrayBuffer`: raw byte storage
- `TypedArray` family: `Uint8Array`, `Int8Array`, `Uint16Array`, `Int16Array`, `Uint32Array`, `Int32Array`, `Float16Array`, `Float32Array`, `Float64Array`, `BigInt64Array`, `BigUint64Array`, `Uint8ClampedArray`
- `DataView`: read/write arbitrary numeric types at byte offsets (getUint8/setUint8 etc.)
- `Buffer`: Node.js Uint8Array subclass with `.toString()`, `.toString("base64")`, `.toString("hex")`
- `Blob`: readonly binary data with MIME type; `text()`, `bytes()`, `arrayBuffer()`, `stream()`, `slice()`
- `BunFile`: lazy-loaded `Blob` subclass for filesystem files
- `File`: `Blob` subclass with name and lastModified

**Bun Extensions on Uint8Array:**
- `new Uint8Array([...]).toBase64()` / `Uint8Array.fromBase64(str)`
- `new Uint8Array([...]).toHex()` / `Uint8Array.fromHex(str)`

**TextEncoder / TextDecoder:** encode strings to Uint8Array and back

**FOSS Candidates:**
- `base64-js` (npm) — base64 encoding without native support
- `iconv-lite` (npm) — character encoding conversion
- `node:buffer` — built-in (Bun-compatible)

---

## 24. Web APIs Supported in Bun

**Purpose:** Standard web APIs available server-side in Bun. Webular builds on these without polyfills.

| Category | APIs |
|---|---|
| HTTP | `fetch`, `Response`, `Request`, `Headers`, `AbortController`, `AbortSignal` |
| URLs | `URL`, `URLSearchParams` |
| Workers | `Worker`, `MessagePort`, `MessageChannel`, `BroadcastChannel`, `structuredClone` |
| Streams | `ReadableStream`, `WritableStream`, `TransformStream`, `ByteLengthQueuingStrategy`, `CountQueuingStrategy` |
| Blob | `Blob` |
| WebSockets | `WebSocket` (client) |
| Encoding | `atob`, `btoa`, `TextEncoder`, `TextDecoder` |
| Timers | `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` |
| Crypto | `crypto`, `SubtleCrypto`, `CryptoKey` |
| Debugging | `console`, `performance` |
| Microtasks | `queueMicrotask` |
| Events | `EventTarget`, `Event`, `ErrorEvent`, `CloseEvent`, `MessageEvent` |
| Realms | `ShadowRealm` |

**FOSS Candidates:** All are native to Bun — no polyfills needed.

---

## 25. Secrets Management — `Bun.secrets`

**Purpose:** OS keychain-backed credential storage (macOS Keychain, Linux libsecret, Windows Credential Manager). Webular CLI stores API keys securely.

**Key API:**
- `await secrets.get({service, name})` or `secrets.get(service, name)`: retrieve → string | null
- `await secrets.set({service, name, value})` or `secrets.set(service, name, value)`: store/update
- `await secrets.delete({service, name})`: remove → boolean
- Operations are async, run on Bun's thread pool
- OS encrypts at rest; only the owning user can retrieve

**FOSS Candidates:**
- `keytar` (npm) — Node.js OS keychain bindings (unmaintained)
- `@napi-rs/keyring` (npm) — Rust-based keyring for Node/Bun
- `dotenv` (npm) — env file loading (less secure, plaintext)

---

## URL Inventory Categorization (320 total URLs)

| Capability Bucket | URL Patterns | Count (approx.) |
|---|---|---|
| **HTTP server/serve** | `/runtime/http/*`, `/guides/http/*` | ~25 |
| **Networking/fetch** | `/runtime/networking/*`, `/guides/http/fetch*`, `/guides/http/fetch-unix`, `/guides/http/proxy`, `/guides/http/tls` | ~15 |
| **WebSockets** | `/runtime/http/websockets`, `/guides/websocket/*` | ~6 |
| **HTML parsing** | `/runtime/html-rewriter`, `/guides/html-rewriter/*` | ~4 |
| **File I/O** | `/runtime/file-io`, `/guides/read-file/*`, `/guides/write-file/*` | ~20 |
| **Streams** | `/runtime/streams`, `/guides/streams/*` | ~15 |
| **Binary data** | `/runtime/binary-data`, `/guides/binary/*` | ~25 |
| **Storage/DB** | `/runtime/sqlite`, `/runtime/sql`, `/runtime/redis`, `/runtime/s3` | ~6 |
| **Build/compile** | `/bundler/executables`, `/bundler/fullstack`, `/bundler/*` | ~12 |
| **Workers/concurrency** | `/runtime/workers` | ~2 |
| **Security** | `/runtime/csrf`, `/runtime/secrets`, `/guides/util/hash-a-password` | ~4 |
| **Shell/process** | `/runtime/shell`, `/runtime/child-process`, `/guides/process/*`, `/guides/runtime/shell` | ~12 |
| **Ecosystem/frameworks** | `/guides/ecosystem/*` | ~20 |
| **Testing** | `/test/*`, `/guides/test/*` | ~25 |
| **Package management** | `/pm/*` | ~18 |
| **Deployment** | `/guides/deployment/*` | ~8 |
| **Runtime config** | `/runtime/environment-variables`, `/runtime/bunfig`, `/runtime/globals` | ~5 |
| **Utilities** | `/runtime/utils`, `/runtime/hashing`, `/runtime/color`, `/guides/util/*` | ~20 |
| **Types/parsing** | `/runtime/json5`, `/runtime/jsonl`, `/runtime/yaml`, `/runtime/toml`, `/runtime/markdown` | ~8 |
| **Other** | `/project/*`, `/typescript*`, `/sitemap.xml`, `/docs/llms.txt`, feedback | ~15 |

---

## Coverage Summary
- **Total URLs in inventory:** 320
- **Deep-read pages:** 30 (all pre-selected feature/API pages)
- **Pages that exceeded token limit (key details captured from summary):** 2 (`bundler/executables`, `runtime/sql`)
- **Pages skipped/errored:** 0 (all 30 scraped successfully)
- **Note:** `runtime/bun-apis` was not scraped (not in final batch); content covered indirectly via other pages
