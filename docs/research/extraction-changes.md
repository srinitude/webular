# Extraction research: ranked changes for webular

Every change below comes from abstract-level reads. No paper was read in full, so each change is a lead to prove on a dev set, not a result. The full paper list, with one verdict per paper, is in `extraction.jsonl` in this folder.

## How to read this list

- Changes are ranked by how much they should move scrape recall (baseline 0.848) or map recall (baseline 0.778), and by how little they need a model call.
- "Dev set" means a fixed set of pages or sites with a gold answer. Each change is proven by running the same dev set before and after, and keeping the change only if the metric rises and no other metric drops.
- A change marked "needs decision-models-first receipt" touches a Jev decision. Do not build it until that receipt exists.

## Ranked changes

1. **Learned link priority by URL path pattern.**
   - File: [`src/lib/crawl-frontier.ts`](../../src/lib/crawl-frontier.ts), with link order in [`src/workflows/map.ts`](../../src/workflows/map.ts).
   - Change: keep a count, per URL path pattern, of how many target pages that pattern has yielded. Use it as the queue priority. Cap each path prefix's share of the final list so one section cannot fill the whole result.
   - Papers: 2602.11874, 2604.18779, 2610.13321, 2609.05766, 2504.18375, 2602.15921.
   - Metric: map recall.
   - Proof: on sites with a known page list, compare map recall at the same fetch budget, before and after.
2. **Index pages first in the page-link walk.**
   - File: [`src/workflows/map.ts`](../../src/workflows/map.ts), `pageLinks`.
   - Change: walk pagination, archive, and category URLs before leaf pages. Detect them from the URL shape alone, with no model call.
   - Papers: 2505.06972, 2603.29161.
   - Metric: map recall.
   - Proof: same map dev set; count gold pages found per fetch.
   - Note: the papers use a page-type classifier. A Jev version of that classifier needs a decision-models-first receipt.
3. **Coverage estimate as the stop rule.**
   - File: [`src/workflows/map.ts`](../../src/workflows/map.ts), and [`src/lib/crawl-resume.ts`](../../src/lib/crawl-resume.ts) for repeated crawls.
   - Change: estimate how many pages are still unseen from link-discovery counts (a Chao1 estimator), and keep expanding while the estimate says many remain.
   - Papers: 2602.24262, 2603.15416.
   - Metric: map recall, and pages fetched.
   - Proof: on sites with a known page count, check that the estimate tracks the true count and that recall rises at equal or lower cost.
4. **Column-aware reading order for PDFs.**
   - File: [`src/lib/parse-pdf.ts`](../../src/lib/parse-pdf.ts), `pageText`.
   - Change: order text items by their x and y position with a recursive XY-Cut split, instead of stream order.
   - Papers: 2504.10258, 2509.11720, 2607.01018.
   - Metric: scrape recall on multi-column PDFs.
   - Proof: about 50 two-column PDFs with reference Markdown; compare reading-order edit distance before and after.
5. **Drop repeated headers and footers from PDFs.**
   - File: [`src/lib/parse-pdf.ts`](../../src/lib/parse-pdf.ts), before the page join.
   - Change: remove lines that repeat on more than 60 percent of pages.
   - Papers: 2609.26381, 2602.11960.
   - Metric: scrape precision and recall.
   - Proof: count repeated lines in the output before and after on the same PDFs.
6. **Fallback chain of extractors on thin results.**
   - File: [`src/lib/html.ts`](../../src/lib/html.ts).
   - Change: when the first extractor returns thin text, run a second one and take the union. Keep code blocks and math. Strip hidden `aria-label`, `alt`, and meta text that can carry injected instructions.
   - Papers: 2602.19548, 2605.21097, 2511.16397, 2508.15096, 2509.05831.
   - Metric: scrape recall on product, listing, and forum pages, where the heuristics score only 0.41 to 0.84 F1.
   - Proof: split the dev set by page type and score each type, using the WCXB benchmark (2605.21097) as one source.
7. **Table serialization that keeps merged cells and multi-level headers.**
   - File: [`src/lib/html-table.ts`](../../src/lib/html-table.ts), `tableToGfm`.
   - Change: repeat spanned text, or add a header-path row. Keep the caption and footnotes with the table.
   - Papers: 2610.29188, 2610.24798, 2606.09578, 2603.19756, 2608.09842.
   - Metric: table cell recall.
   - Proof: score cell-text overlap on the tables from 2608.09842.
8. **Use the site's own data call before rendering.**
   - Files: [`src/lib/driver.ts`](../../src/lib/driver.ts) and [`src/lib/fetch-layer.ts`](../../src/lib/fetch-layer.ts).
   - Change: during a render, record the XHR and JSON calls the page makes, and reuse those endpoints. Strip hidden nodes before extraction.
   - Papers: 2604.00694, 2602.08242, 2605.03129.
   - Metric: scrape recall on pages that need JavaScript, and median latency.
   - Proof: run the JavaScript-only subset of the scrape dev set.
9. **Ranked locator ladder, one selector per repeated item.**
   - File: [`src/lib/select.ts`](../../src/lib/select.ts).
   - Change: try role, `data-testid`, `aria-label`, then text in turn. Derive one CSS selector that captures all repeated siblings. Cache selectors per host.
   - Papers: 2603.20358, 2504.12682, 2606.14821, 2608.27466.
   - Metric: field recall on listing pages.
   - Proof: compare gold item counts with the counts the selector returns on listing pages.
   - Note: 2608.27466 learns a wrapper with a model; a Jev version needs a decision-models-first receipt.
10. **Filter archive fallback URLs.**
    - File: [`src/lib/archive-urls.ts`](../../src/lib/archive-urls.ts).
    - Change: keep only archive URLs that are HTML, returned status 200, and are not repeated captures of one page.
    - Papers: 2507.14752, 2507.22019.
    - Metric: map precision.
    - Proof: precision of the archive fallback on dead-site dev cases.

## Other leads, not ranked

- Page-quality flag in `parse-pdf.ts` and `parse-worker.ts`: score each page by simple ratios and send only poor pages to an optional heavier backend (2505.01435, 2603.00122).
- Structure-aware chunking in [`src/lib/local-chunks.ts`](../../src/lib/local-chunks.ts) and `answer-passage.ts`: split on heading and table boundaries and return the table header with each hit (2603.24556, 2604.04936).
- Crawl hygiene in `robots-gate.ts` and `polite-crawler.ts`: log every robots decision (2503.06035), honor `X-Robots-Tag` and `meta robots` (2511.08637).
- Recrawl order from sitemap `lastmod` and ETag signals (2502.02430, 2607.13636).
- Screenshot work in `driver-screenshot.ts`: a pixel diff against a re-render to flag pages where extraction missed visible content (2602.05998); tall-page splitting before any vision call (2508.03560, 2507.22827).
- Offer fields from JSON-LD, microdata, and `og:` tags before heuristics, in `json-ld.ts` (2609.01030).

## Limits of this research

- All reads are abstract-only. The searches hit rate limits (HTTP 429) from the arXiv API and the paper index, so most dates are the first of the arXiv id's month, not the exact day.
- The repo checks behind "already-done" verdicts were skims of file headers and exports. Treat those verdicts as unconfirmed.
- Models named in the papers (ReaderLM and similar) would be Jev or model decisions, and need a decision-models-first receipt before any use.
