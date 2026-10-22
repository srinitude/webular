# Sources

This file lists every source the spec cites, with its URL, its date, and what it says.
Helpers read these on 2026-10-21.
Most arXiv entries were checked from the abstract only. "date nf" means no date was found.
Start with the spec in [benchmark-spec.md](benchmark-spec.md).

## Search, browsing, and research benchmarks

- **WANDR** | https://arxiv.org/abs/2608.14747 | 2026-08 | 500 wide-and-deep collection tasks from Perplexity usage logs; judges re-fetch cited pages; best soft F1 0.363; Apache-2.0.
- **HyperBrowseComp** | https://arxiv.org/abs/2610.03574 | 2026-10 | 423 browsing questions in 13 languages, written by native speakers.
- **XBCP** | https://arxiv.org/abs/2606.15345 | 2026-06 | BrowseComp-Plus evidence machine-translated into 12 languages; accuracy drops.
- **K-BrowseComp** | https://arxiv.org/abs/2606.02404 | 2026-06-01 | 300 verified Korean browsing questions plus 100 synthetic ones.
- **LiveNewsBench** | https://arxiv.org/abs/2602.13543 | 2026-02-14 | multi-hop search over news, with a human-verified subset; CC BY-SA 4.0.
- **LiveSearchBench** | https://arxiv.org/abs/2511.01409 | 2025-11-03 | multi-hop questions built from Wikidata diffs and checked with SPARQL.
- **LiveResearchBench** | https://arxiv.org/abs/2510.14240 | 2025-10 | 100 expert-written cited-report tasks on the live web; Apache-2.0.
- **WebArena Verified** | https://github.com/ServiceNow/webarena-verified | 2025-09-19 | hand-reviewed WebArena tasks with deterministic checks; Apache-2.0.
- **SimpleQA Verified** | https://arxiv.org/abs/2509.07968 | 2025-09-09 | 1,000 cleaned SimpleQA prompts; GPT-4.1 autorater; paper CC BY 4.0.
- **DeepScholar-Bench** | https://arxiv.org/abs/2508.20033 | 2025-08 | cited related-work writing; no system above 31%; MIT.
- **BrowseComp-Plus** | https://arxiv.org/abs/2508.06600 | 2025-08-08 | 830 queries on a fixed 100,195-doc corpus with verified evidence; MIT.
- **Mind2Web 2** | https://arxiv.org/abs/2506.21506 | 2025-06-26 | 130 long-horizon cited-search tasks graded by per-task agent judges.
- **DeepResearch Bench** | https://arxiv.org/abs/2506.11763 | 2025-06 | 100 PhD-level report tasks; RACE quality and FACT citation scores.
- **SealQA** | https://arxiv.org/abs/2506.01062 | 2025-06-01 | QA under conflicting search results; Seal-0 keeps questions all frontier models failed; Apache-2.0.
- **BrowseComp-ZH** | https://arxiv.org/abs/2504.19314 | 2025-04-27 | 289 Chinese-web questions over 11 domains; MIT, academic use only.
- **BrowseComp** | https://arxiv.org/abs/2504.12516 | 2025-04-10 | 1,266 inverted, hard-to-find questions with short answers; near saturation.
- **Humanity's Last Exam** | https://arxiv.org/abs/2501.14249 | 2025-01-24 | 2,500 expert questions; an Epoch AI audit found errors in 22 of 48 sampled.
- **HLE leaderboard** | https://scale.com/leaderboard/humanitys_last_exam | date nf | keeps a private held-out split to measure overfitting.
- **WebWalkerQA** | https://arxiv.org/abs/2501.07572 | 2025-01 | 680 in-site traversal questions in English and Chinese; GPT-4 judge.
- **SimpleQA** | https://arxiv.org/abs/2411.04368 | 2024-11-07 | correct, incorrect, and not-attempted grading; two trainers agree on each answer.
- **FRAMES** | https://arxiv.org/abs/2409.12941 | 2024-09-19 | 824 multi-hop questions over 2-15 Wikipedia articles; autorater kappa 0.889; Apache-2.0.
- **BRIGHT** | https://arxiv.org/abs/2407.12883 | 2024-07 | 1,398 reasoning-heavy retrieval queries graded by nDCG@10.
- **LiveBench** | https://arxiv.org/abs/2406.19314 | 2024-06-27 | questions from recent sources, refreshed monthly, scored without an LLM judge.
- **CRAG** | https://arxiv.org/abs/2406.04744 | 2024-06-07 | splits by domain, question type, popularity, and how fast facts change.
- **VisualWebArena** | https://arxiv.org/abs/2401.13649 | 2024-01 | 910 multimodal browser tasks; MIT.
- **GAIA** | https://arxiv.org/abs/2311.12983 | 2023-11-21 | assistant tasks with exact-match answers; gated, no reshare; saturated.
- **FreshQA** | https://arxiv.org/abs/2310.03214 | 2023-10-05 | fast-changing and false-premise questions, refreshed through April 2026; Apache-2.0.
- **WebArena** | https://arxiv.org/abs/2307.13854 | 2023-07 | 812 browser tasks on self-hosted sites, with brittle checkers.
- **ALCE** | https://arxiv.org/abs/2305.14627 | 2023-05 | citation precision and recall for cited answers.
- **BEIR** | https://arxiv.org/abs/2104.08663 | 2021 | zero-shot retrieval over 18 datasets graded by nDCG@10.

## Agent tool-use and MCP benchmarks

- **MCP-Atlas** | https://arxiv.org/abs/2602.00933 | 2026-02 | 1,000 human-written tasks over 36 real MCP servers; a claim-level rubric on the final answer gives partial credit.
- **MCPMark** | https://arxiv.org/abs/2509.24002 | 2025-09-28 | 127 tasks over Notion, GitHub, Filesystem, PostgreSQL, and Playwright; verification scripts; pass@1 and pass^4.
- **MCP-Bench** | https://arxiv.org/abs/2508.20453 | 2025-08-28 | 28 live MCP servers and 250 tools; fuzzy multi-hop tasks; tool-level, trajectory-level, and completion scores.
- **MCP-Universe** | https://arxiv.org/abs/2508.14704 | 2025-08-20 | 11 real MCP servers in 6 domains; execution-based evaluators, some with real-time ground truth.
- **LiveMCPBench** | https://arxiv.org/abs/2508.01780 | 2025-08 | 95 daily tasks over 70 servers and 527 tools; an LLM judge with 81% human agreement handles changing data.
- **BFCL** | https://proceedings.mlr.press/v267/patil25a.html | 2025-07-13 | function calling, including abstention and multi-turn state, graded by AST matching and executable checks.
- **τ²-bench** | https://arxiv.org/abs/2506.07982 | 2025-06-09 | agent tasks with a simulated user, graded by final database state and pass^k.

## LLM-as-judge bias

- **Evaluating Scoring Bias in LLM-as-a-Judge** | https://arxiv.org/abs/2506.22316 | 2025-06 | score-based judges shift under small perturbations.
- **Beyond the Surface: Measuring Self-Preference** | https://arxiv.org/abs/2506.02592 | 2025-06-03 | self-preference measured as the judge's score minus the gold score.
- **Judging the Judges: Position Bias** | https://doi.org/10.18653/v1/2025.ijcnlp-long.18 | 2025 | 15 judges; position consistency and preference fairness.
- **Self-Preference Bias in LLM-as-a-Judge** | https://arxiv.org/abs/2410.21819 | 2024-10 | a fairness-style self-preference metric, tied to output perplexity.
- **Justice or Prejudice? (CALM)** | https://arxiv.org/abs/2410.02736 | 2024-10-04 | 12 judge biases, including position, verbosity, and self-preference.

## Method and statistics

- **Bias audit of the current bench** | the bias audit report | 2026-10-21 | 16 ranked findings and a hand re-grade of 23 rows.
- **BetterBench** | https://arxiv.org/abs/2411.12990 | 2024-11 | a benchmark release checklist; most benchmarks report no significance and are hard to replicate.
- **Anthropic, A statistical approach to model evals** | https://www.anthropic.com/research/statistical-approach-to-model-evals | 2024-11-19 | mean ± 1.96 SEM, clustered SEs, paired tests, and power analysis before the run.
- **Miller, Adding Error Bars to Evals** | https://arxiv.org/abs/2411.00640 | 2024-11 | the formal version of those rules.
- **Card et al., With Little Power Comes Great Responsibility** | https://arxiv.org/abs/2010.06595 | 2020-10 | compute power first; many NLP comparisons are underpowered.
- **Dietterich, Approximate statistical tests** | https://web.engr.oregonstate.edu/~tgd/publications/dietterich-approximate-statistical-tests-nc1998.pdf | 1998 | use McNemar for one run on one test set.
- **Berg-Kirkpatrick et al.** | https://aclanthology.org/D12-1091 | 2012 | the paired bootstrap for NLP significance.
- **Dror et al.** | https://aclanthology.org/Q17-1033 | 2017 | Holm correction across many datasets.
- **Thakur et al., Judging the Judges** | https://arxiv.org/abs/2406.12624 | 2024-06-18 | report Cohen's kappa; top judges reach about 0.79-0.84 and lean lenient.
- **Zheng et al., MT-Bench** | https://arxiv.org/abs/2306.05685 | 2023-06 | swap answer order and control length; strong judges agree with humans about 80% of the time.
- **Panickssery et al.** | https://arxiv.org/abs/2404.13076 | 2024-04 | models favor their own outputs; hide authorship from the judge.
- **Kapoor et al., AI Agents That Matter** | https://arxiv.org/abs/2407.01502 | 2024-07 | report cost and accuracy as a Pareto curve, with cheap baselines.
- **Holistic Agent Leaderboard** | https://arxiv.org/abs/2510.11977 | 2025-10 | one harness, dollar cost per run, and log review for agents that look up the benchmark.
- **HELM** | https://arxiv.org/abs/2211.09110 | 2022-11 | publish raw prompts and outputs so anyone can re-score.
- **τ-bench** | https://arxiv.org/abs/2406.12045 | 2024-06 | pass^k across repeated tries.
- **BIG-bench canary post** | https://www.lesswrong.com/posts/kSmHMoaLKGcGgyWzs/big-bench-canary-contamination-in-gpt-4 | date nf | canary GUIDs in benchmark files catch leaks.
- **Anthropic, eval awareness on BrowseComp** | https://www.anthropic.com/engineering/eval-awareness-browsecomp | date nf | a model found and decoded benchmark answers on the web.
- **Artificial Analysis methodology** | https://artificialanalysis.ai/methodology/performance-benchmarking | 2026-03-02 | 8 runs a day, P50 over 72 hours, a 10-way parallel test, a named region, and cache hits measured apart.
- **Raasveldt et al.** | https://ir.cwi.nl/pub/27862 | 2018-06 | report cold and hot runs apart.
- **Proxyway, Web Scraping API Report** | https://proxyway.com/research/web-scraping-api-report-2025 | 2025-12-04 | 15 anti-bot targets, 2 and 10 req/s, a 600 s timeout, and a hidden target list.
- **Apify, Web Unblocker benchmark** | https://blog.apify.com/web-unblocker-benchmark/ | 2026-09-08 | reports blocked apart from no response.

## Scrape and extraction

- **Trafilatura evaluation** | https://trafilatura.readthedocs.io/en/stable/evaluation.html | 2026-10-02 | 990 docs; trafilatura F 0.926; raw HTML baseline F 0.667.
- **ScrapingHub article-extraction-benchmark** | https://github.com/scrapinghub/article-extraction-benchmark | 2026-06-24 | 181 articles; trafilatura word F1 0.958; saturated.
- **WCXB** | https://webcontentextraction.org | 2026-03-29 | 2,008 pages of 7 types, with must-include and must-exclude snippets; CC-BY-4.0; non-article pages drop 20-30 points.
- **WCXB repo** | https://github.com/Murrough-Foley/web-content-extraction-benchmark | 2026-03-29 | the same set and its scorer.
- **CleanEval** | https://aclanthology.org/L08-1369/ | 2008 | text alignment, edit distance, and segment validity scored apart.
- **Mozilla Readability** | https://github.com/mozilla/readability | date nf | golden-file test pages with expected metadata.
- **Bevendorff et al.** | https://doi.org/10.1145/3539618.3591920 | 2023-07-18 | 8 merged datasets; split scores by extraction complexity.
- **NeuScraper** | https://aclanthology.org/2024.acl-short.72.pdf | 2024 | node-level extraction on ClueWeb22.
- **ReaderLM paper** | https://arxiv.org/abs/2503.01151 | 2025-03 | an HTML-to-Markdown model; independent runs score it far lower.
- **Dripper and WebMainBench** | https://arxiv.org/abs/2511.23119 | 2025-11 | 7,809 pages in 46 languages; table TEDS 0.30 for trafilatura, 0.74 for MinerU-HTML.
- **scrape-evals** | https://github.com/martynasoxylabs/scrape-evals | 2025-11-21 | 1,000 live URLs with core snippets; MIT; drifts with the web.
- **WebMainBench dataset** | https://huggingface.co/datasets/opendatalab/WebMainBench | 2026-04-08 | read at revision `5da0972e9b58d0c7891ae75053ced97c268f52e3`; fields html, url, main_html, convert_main_content, groundtruth_content, track_id; Apache-2.0 labels over third-party pages. Fetched at run time: the 545-row subset file, 100 rows pinned in [`bench/datasets/webmainbench.json`](../datasets/webmainbench.json).
- **Firecrawl scrape content dataset** | https://huggingface.co/datasets/firecrawl/scrape-content-dataset-v1 | 2025-10-23 | read at revision `aad2b002cd74147236ee6fb4fd7e2bcf28955c3c`; 1,000 URLs with truth_text and lie_text snippets; MIT labels over third-party pages. Fetched at run time and pinned in [`bench/datasets/firecrawl-scrape.json`](../datasets/firecrawl-scrape.json).
- **OmniDocBench** | https://github.com/opendatalab/OmniDocBench | 2025-09-25 | 1,651 PDF pages; edit distance, TEDS, CDM; data for research only.
- **olmOCR-Bench** | https://github.com/allenai/olmocr/tree/main/olmocr/bench | 2025 | 1,402 PDFs with 7,010 pass/fail unit tests.
- **olmOCR paper** | https://arxiv.org/abs/2502.18443 | 2025-02 | why unit tests beat edit distance for PDFs.
- **PubTabNet** | https://github.com/ibm-aur-nlp/PubTabNet | 2020-07-01 | TEDS for tables; CDLA-Permissive-1.0 annotations.

## Vendors and independent boards

- **Exa 3.0** | https://exa.ai/blog/exa-3 | 2026-10-19 | first on 8 of its own benchmarks; BrowseComp 91.8%.
- **Firecrawl benchmarks** | https://firecrawl.dev/benchmarks | 2026-10-15 | 80.5% on its own benchmark.
- **Parallel benchmarks** | https://parallel.ai/benchmarks | 2026-09-09 | 97% on SimpleQA Verified.
- **Tavily** | https://tavily.com/blog/tavily-ranks-1-on-sealqa-and-simpleqa | 2026-08-11 | first on SealQA and SimpleQA Verified.
- **Brave AI Grounding** | https://brave.com/blog/ai-grounding | 2025-09-01 | SimpleQA F1 92.1%.
- **You.com Research API** | https://you.com/resources/research-api-by-you-com | 2026-02-26 | DeepSearchQA 83.67%.
- **Linkup** | https://linkup.so/blog/best-web-search-api-in-2026-top-providers-compared | 2026-06-15 | 94% on SimpleQA Verified.
- **Valyu DeepResearch** | https://valyu.ai/blogs/introducing-deepresearch | date nf | DRACO 72.7%.
- **Spider** | https://spider.cloud/blog/firecrawl-vs-crawl4ai-vs-spider-honest-benchmark | 2026-02-11 | 99.9% success, which the vendor calls unverified.
- **Diffbot** | https://www.diffbot.com | 2025-01-09 | Diffbot LLM 81% on FreshQA, from a press release.
- **Zyte** | https://www.zyte.com/blog/best-web-scraping-apis-2026 | 2025-12 | 93.14% success at 2 req/s, citing Proxyway.
- **AIMultiple agentic search** | https://aimultiple.com/agentic-search | 2026-02 | 100 queries, LLM judge; the top four are tied.
- **OpenBenchmarks web search** | https://openbenchmarks.com/web-search | 2026-09-15 | 100 developer tasks; Perplexity first at 77.3; the operator is not named.
- **Artificial Analysis Search API** | https://artificialanalysis.ai/agents/search-api | 2026-09 | Perplexity 80, Octen 77, Parallel 75, Brave 75, read second-hand.
