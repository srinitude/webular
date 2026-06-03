# webular — use-case test results

**264/264 passed** (exit 0) via the webular CLI layer.

| Group | Pass | Total |
|---|--:|--:|
| parse | 40 | 40 |
| scrape | 54 | 54 |
| extract | 36 | 36 |
| map | 22 | 22 |
| crawl | 14 | 14 |
| summarize | 28 | 28 |
| media | 14 | 14 |
| monitor | 14 | 14 |
| act | 10 | 10 |
| search | 8 | 8 |
| answer | 5 | 5 |
| research | 4 | 4 |
| batch | 4 | 4 |
| meta | 11 | 11 |

## Failures

_None — all use cases passed._

## Sample passing output (real CLI runs)

- #11 [parse] 2480ms — { "file": "/tmp/webular-uc/fixtures/doc3.txt", "format": "txt", "markdown": "Support ticke
- #22 [parse] 1861ms — { "file": "/tmp/webular-uc/fixtures/doc6.md", "format": "md", "markdown": "# Runbook 6\n\n
- #33 [parse] 3540ms — { "file": "/tmp/webular-uc/fixtures/doc1.json", "format": "json", "markdown": "{\n \"id\":
- #44 [scrape] 3859ms — # Internet Assigned Numbers Authority The global coordination of the DNS Root, IP addressi
- #55 [scrape] 23235ms — # Sitemaps **Checked** [![Page protected with pending changes](//upload.wikimedia.org/wiki
- #66 [scrape] 3027ms — # Welcome to Python.org **Notice:** This page displays a fallback because interactive scri
- #77 [scrape] 1948ms — { "url": "https://www.rfc-editor.org/rfc/rfc1149.html", "title": "", "markdown": "Network 
- #88 [scrape] 2335ms — 
- #99 [extract] 3381ms — { "url": "https://www.iana.org/about", "data": { "title": "About us" } }
- #110 [extract] 10107ms — { "url": "https://en.wikipedia.org/wiki/Cascading_Style_Sheets", "data": { "title": "CSS -
- #121 [extract] 6857ms — { "url": "https://www.iana.org/domains", "matches": [ "Domains", "Protocols", "Numbers", "
- #132 [map] 1662ms — { "url": "https://example.org", "count": 1, "links": [ "https://iana.org/domains/example" 
- #143 [map] 2159ms — { "url": "https://en.wikipedia.org/wiki/HTTP", "count": 1000, "links": [ "https://en.wikip
- #154 [crawl] 1837ms — { "root": "https://example.org", "count": 1, "pages": [ { "url": "https://example.org", "t
- #165 [crawl] 5575ms — { "root": "https://en.wikipedia.org/wiki/HTTP", "count": 2, "pages": [ { "url": "https://e
- #176 [summarize] 1322ms — { "sentences": [ "A web crawler discovers pages by following links." ], "summary": "A web 
- #187 [summarize] 1837ms — { "sentences": [ "This domain is for use in documentation examples without needing permiss
- #198 [media] 5924ms — { "url": "https://www.iana.org", "savedTo": "/tmp/webular-uc/out/dl3.bin", "bytes": 6142, 
- #209 [monitor] 12110ms — { "url": "https://example.com", "changeStatus": "new" }
- #220 [monitor] 3205ms — { "url": "https://en.wikipedia.org/wiki/Web_crawler", "changeStatus": "new" }
- #231 [act] 8628ms — { "url": "https://example.com", "snapshot": "✓ Example Domain\n https://example.com/\n\n- 
- #242 [answer] 1888ms — { "query": "what is web scraping best practices", "answer": "What Is Web Scraping? What Is
- #253 [batch] 2751ms — { "op": "scrape", "count": 2, "results": [ { "url": "https://www.python.org", "ok": true, 
- #264 [meta] 97ms — webular 0.0.0