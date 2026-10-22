# Accuracy scoreboard

Each row is one metric for one command. "gap" means no eval measures it yet.
"peer dev" rows come from the committed peer run; "dev" rows come from offline
evals on fixtures. `mise run bench:scoreboard` writes this table and
[bench/scoreboard.json](../bench/scoreboard.json).

<!-- scoreboard:start -->
| Command | Metric | Value | Best rival | Eval | Set |
|---|---|---|---|---|---|
| `search` | accuracy | 1.0000 | youcom 1.0000 | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `search` | hit@1 | gap |  |  |  |
| `search` | hit@10 | gap |  |  |  |
| `search` | precision | gap |  |  |  |
| `search` | recall | gap |  |  |  |
| `search` | cost per success usd | 0.0000 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `search` | robustness | gap |  |  |  |
| `search` | test pass rate | gap |  |  |  |
| `search` | determinism | 0.2500 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `search` | latency p50 ms | 459 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `search` | latency p95 ms | 782 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `scrape` | accuracy | 1.0000 | exa 1.0000 | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `scrape` | recall | 0.8478 (ceiling below 1) |  | [`tests/bench/scrape-accuracy.test.ts`](../tests/bench/scrape-accuracy.test.ts) | dev |
| `scrape` | leak | 0.0000 |  | [`tests/bench/scrape-accuracy.test.ts`](../tests/bench/scrape-accuracy.test.ts) | dev |
| `scrape` | script pages routed to browser | 1.0000 |  | [`tests/bench/scrape-accuracy.test.ts`](../tests/bench/scrape-accuracy.test.ts) | dev |
| `scrape` | robustness | gap |  |  |  |
| `scrape` | test pass rate | gap |  |  |  |
| `scrape` | determinism | 1.0000 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `scrape` | latency p50 ms | 564 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `scrape` | latency p95 ms | 6708 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `crawl` | precision | 1.0000 |  | [`tests/commands/crawl-accuracy.test.ts`](../tests/commands/crawl-accuracy.test.ts) | dev |
| `crawl` | recall | 1.0000 |  | [`tests/commands/crawl-accuracy.test.ts`](../tests/commands/crawl-accuracy.test.ts) | dev |
| `crawl` | F1 | 1.0000 |  | [`tests/commands/crawl-accuracy.test.ts`](../tests/commands/crawl-accuracy.test.ts) | dev |
| `crawl` | test pass rate | gap |  |  |  |
| `crawl` | determinism | 1.0000 |  | [`tests/commands/crawl-accuracy.test.ts`](../tests/commands/crawl-accuracy.test.ts) | dev |
| `crawl` | latency p50 ms | gap |  |  |  |
| `crawl` | latency p95 ms | gap |  |  |  |
| `map` | precision | 1.0000 |  | [`tests/commands/map-accuracy.test.ts`](../tests/commands/map-accuracy.test.ts) | dev |
| `map` | recall | 1.0000 |  | [`tests/commands/map-accuracy.test.ts`](../tests/commands/map-accuracy.test.ts) | dev |
| `map` | F1 | 1.0000 |  | [`tests/commands/map-accuracy.test.ts`](../tests/commands/map-accuracy.test.ts) | dev |
| `map` | test pass rate | gap |  |  |  |
| `map` | determinism | gap |  |  |  |
| `map` | latency p50 ms | gap |  |  |  |
| `map` | latency p95 ms | gap |  |  |  |
| `extract` | exact match | 1.0000 |  | [`tests/commands/extract-accuracy.test.ts`](../tests/commands/extract-accuracy.test.ts) | dev |
| `extract` | normalized match | 1.0000 |  | [`tests/commands/extract-accuracy.test.ts`](../tests/commands/extract-accuracy.test.ts) | dev |
| `extract` | test pass rate | gap |  |  |  |
| `extract` | determinism | gap |  |  |  |
| `extract` | latency p50 ms | gap |  |  |  |
| `extract` | latency p95 ms | gap |  |  |  |
| `summarize` | ROUGE-1 F1 | 0.1867 (ceiling below 1) |  | [`tests/commands/summarize-accuracy.test.ts`](../tests/commands/summarize-accuracy.test.ts) | dev |
| `summarize` | ROUGE-2 F1 | 0.0474 (ceiling below 1) |  | [`tests/commands/summarize-accuracy.test.ts`](../tests/commands/summarize-accuracy.test.ts) | dev |
| `summarize` | oracle ROUGE-1 | 0.2399 (ceiling below 1) |  | [`tests/commands/summarize-accuracy.test.ts`](../tests/commands/summarize-accuracy.test.ts) | dev |
| `summarize` | coverage | 0.7610 (ceiling below 1) |  | [`tests/commands/summarize-accuracy.test.ts`](../tests/commands/summarize-accuracy.test.ts) | dev |
| `summarize` | faithfulness | 1.0000 |  | [`tests/commands/summarize-accuracy.test.ts`](../tests/commands/summarize-accuracy.test.ts) | dev |
| `summarize` | test pass rate | gap |  |  |  |
| `summarize` | determinism | gap |  |  |  |
| `summarize` | latency p50 ms | gap |  |  |  |
| `summarize` | latency p95 ms | gap |  |  |  |
| `answer` | accuracy | 0.7143 | parallel 1.0000 | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `answer` | citation faithfulness | gap |  |  |  |
| `answer` | sure-but-wrong | gap |  |  |  |
| `answer` | no-answer rate | gap |  |  |  |
| `answer` | Jev eval pass rate | gap |  |  |  |
| `answer` | cost per success usd | 0.0000 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `answer` | robustness | gap |  |  |  |
| `answer` | test pass rate | gap |  |  |  |
| `answer` | determinism | 0.4286 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `answer` | latency p50 ms | 2737 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `answer` | latency p95 ms | 3460 |  | [`bench/results/peers-2026-10-22T07-59-24-916Z.json`](../bench/results/peers-2026-10-22T07-59-24-916Z.json) | peer dev |
| `research` | accuracy | gap |  |  |  |
| `research` | citation faithfulness | gap |  |  |  |
| `research` | sure-but-wrong | gap |  |  |  |
| `research` | no-answer rate | gap |  |  |  |
| `research` | Jev eval pass rate | gap |  |  |  |
| `research` | cost per success usd | gap |  |  |  |
| `research` | robustness | gap |  |  |  |
| `research` | test pass rate | gap |  |  |  |
| `research` | determinism | gap |  |  |  |
| `research` | latency p50 ms | gap |  |  |  |
| `research` | latency p95 ms | gap |  |  |  |
| `parse` | accuracy | 1.0000 |  | [`tests/quality/parse-pdf-fidelity.test.ts`](../tests/quality/parse-pdf-fidelity.test.ts) | dev |
| `parse` | test pass rate | gap |  |  |  |
| `parse` | determinism | gap |  |  |  |
| `parse` | latency p50 ms | gap |  |  |  |
| `parse` | latency p95 ms | gap |  |  |  |
| `media` | accuracy | gap |  |  |  |
| `media` | test pass rate | gap |  |  |  |
| `media` | determinism | gap |  |  |  |
| `media` | latency p50 ms | gap |  |  |  |
| `media` | latency p95 ms | gap |  |  |  |
| `monitor` | accuracy | gap |  |  |  |
| `monitor` | test pass rate | gap |  |  |  |
| `monitor` | determinism | gap |  |  |  |
| `monitor` | latency p50 ms | gap |  |  |  |
| `monitor` | latency p95 ms | gap |  |  |  |
| `batch` | accuracy | 1.0000 |  | [`tests/commands/batch-accuracy.test.ts`](../tests/commands/batch-accuracy.test.ts) | dev |
| `batch` | test pass rate | gap |  |  |  |
| `batch` | determinism | 1.0000 |  | [`tests/commands/batch-accuracy.test.ts`](../tests/commands/batch-accuracy.test.ts) | dev |
| `batch` | latency p50 ms | gap |  |  |  |
| `batch` | latency p95 ms | gap |  |  |  |
| `doctor` | test pass rate | gap |  |  |  |
| `tasks` | test pass rate | gap |  |  |  |
| `mcp` | test pass rate | gap |  |  |  |
| `diagram` | test pass rate | gap |  |  |  |
| `audit` | test pass rate | gap |  |  |  |
| `act` | test pass rate | gap |  |  |  |
| `act` | robustness | gap |  |  |  |
| `feed` | accuracy | 1.0000 |  | [`tests/commands/feed-accuracy.test.ts`](../tests/commands/feed-accuracy.test.ts) | dev |
| `feed` | test pass rate | gap |  |  |  |
| `feed` | determinism | 1.0000 |  | [`tests/commands/feed-accuracy.test.ts`](../tests/commands/feed-accuracy.test.ts) | dev |
| `feed` | latency p50 ms | gap |  |  |  |
| `feed` | latency p95 ms | gap |  |  |  |
| `jev` | Jev eval pass rate | gap |  |  |  |
| `jev` | test pass rate | gap |  |  |  |
<!-- scoreboard:end -->

Return to the [command reference](commands.md) (navigation only).
