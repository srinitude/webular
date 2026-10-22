# Reliability

Read this page to learn how webular retries a failed fetch and what it does
when a page is dead or a site will not answer.

## Retries

- Every fetch retries 408, 429, 502, 503, and 504 on a fixed backoff.
- When the server sends `Retry-After`, the fetch waits that long instead, up to 10 s.
- If the server asks for more than 10 s, the fetch fails at once. The error names the wait, for example `asked to wait 120 s (Retry-After), over the 10 s limit`.
- If the wait would run past the request's timeout, the fetch returns the server's status (such as 429) at once.

## Archive and index fallbacks

These flags and fallbacks cover a dead page and a site that will not answer.

### Archive flags

- `scrape --archive` uses the Wayback Machine's raw capture when the page is dead (404, 410, 5xx, network error, or timeout). It reports the capture as `archivedFrom`.
- `batch --archive` does the same for each URL.

### Reads without a flag

- `answer`, `research`, `extract`, and `media` (download) read a dead page from its archive copy without a flag; they find the capture through the availability API, then the Wayback CDX index.

### When a site's root will not answer

- `map` asks the Wayback CDX and Common Crawl's index for its URLs.
- `crawl` asks Common Crawl's index and the Wayback CDX.

Return to the [README](../README.md) (navigation only).
