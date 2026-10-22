# Agents reading group: ranked changes for webular

## Why this file exists

Most webular misses in the rival benchmark are runs where the model never called the tool. This file ranks the changes the agents reading group supports. Tool-call rate comes first, pass rate second. Nothing here has been run on a webular dev set. Every metric is the number a paper reported, so each change needs its own before-and-after run before it is kept.

## What was read

- 712 distinct papers and sources, merged from six readers and an AGENTS.md reader. Each row is in [papers.jsonl](papers.jsonl) with topic `agents` or `agents-md`.
- 654 were read by abstract only and 58 in full text. That is short of the plan to read every applicable paper in full. The arXiv API and the Firecrawl paper reader returned HTTP 429 on most calls.
- Verdicts: 308 apply, 94 already-done, 310 not-applicable.
- Most dates are the first of the month taken from the arXiv id, not the real submission day.
- Gaps: papers on WebArena, GAIA, FRAMES, SimpleQA, and HLE, search-API comparisons (Exa, Tavily, Perplexity), and tool-use RL training are thin or missing. Many "already-done" verdicts came from a shallow code read, so check each one before acting.
- The readers disagreed on one point. One reports a "most effective tool, call whenever possible" line raised use about 7 times (2505.18135). Another says to avoid superlatives (2602.18764, 2606.30775). Test both wordings.
- `src/mcp` does not exist in the factor-map-gaps worktree. The MCP server is [`plugins/webular/src/server.ts`](../../plugins/webular/src/server.ts), which passes no `instructions`. Two readers found an `INSTRUCTIONS` constant in [`src/commands/mcp.ts`](../../src/commands/mcp.ts) of another worktree. Confirm which file serves the plugin.

## Ranked changes for tool-call rate

### 1. Rule out harness artifacts and label every miss

- Files: [`tests/models/agent/rates.ts`](../../tests/models/agent/rates.ts), `row.ts`, `judge.ts`, `arm.ts`.
- Change: label each miss as Tool-Skip (never called), Result-Ignore, Unnecessary-Tool-Use, or wrong answer. Log raw tool-call attempts next to parsed calls. Assert that no arm sends tools together with a JSON-schema `response_format`.
- Papers: 2606.25605 (constrained decoding took tool calls to 0%), 2609.03966 (the same model scored 0.00 or 0.96 by adapter alone), 2607.04686, 2608.02464, 2509.25370.
- Metric: share of misses that are real never-called runs. Deterministic checks caught 60 to 96% of failures with no false positives (2608.02464).
- Proof: run the agent bench once and report the miss split. If many zero-call runs hold a well-formed call in raw output, fix the harness before touching any wording.

### 2. Add MCP server instructions that tell the model when to call

- Files: [`plugins/webular/src/server.ts`](../../plugins/webular/src/server.ts) (add `instructions`), and `INSTRUCTIONS` in [`src/commands/mcp.ts`](../../src/commands/mcp.ts) if that is the live file.
- Change: one short directive ("for any web fact you cannot verify from memory, call webular first; say unknown if nothing is found"), one worked example call, and a cross-hint in the search and scrape descriptions. Use all three together.
- Papers: 2608.08467, 2508.12566, 2605.23916, 2610.05348, 2605.14038, 2608.25198, 2604.04651.
- Metric: with all three parts, 20 of 24 models reached 86% or more first-call use (2608.08467). A directive alone can backfire: GPT-5.2 fell from 5% to 0%.
- Proof: factorial run of directive, example, and cross-hint on the rival bench. Read first-call tool-call rate per model.
- Flag: if a Jev step decides when to call (2605.09252, 2605.14038), it needs decision-models-first receipt.

### 3. Rewrite descriptions: purpose, trigger, return value

- File: [`plugins/webular/src/descriptions.json`](../../plugins/webular/src/descriptions.json). Another helper owns the rewrite, so this is ranking input only.
- Change: say the purpose first, add an explicit "use when" trigger, name the limits and what comes back, and add "use X instead of Y" lines such as batch over scrape. Test one priority line against the built-in WebSearch and WebFetch.
- Papers: 2505.18135, 2602.18914, 2602.14878, 2510.02554, 2605.23916, 2606.30775.
- Metric: clear function wording added 11.6 points of selection (2602.18914). Compliant descriptions were picked 72% of the time against 20% (2510.02554). Median task success rose 5.85 points, with 67% more steps (2602.14878).
- Proof: same tasks, only the descriptions change, tool-call rate before and after.

### 4. Make skill and hint text mandatory and phrased as doing

- Files: [`plugins/webular/skills/webular-research/SKILL.md`](../../plugins/webular/skills/webular-research/SKILL.md), `HINT` in [`tests/models/agent/arm.ts`](../../tests/models/agent/arm.ts).
- Change: use execution verbs (search, fetch, verify), not analyze or explain. Remove any "decide whether you need a tool" step. Keep one positive scope line and keep the skill short. Pin the "use webular" line so a compaction cannot drop it.
- Papers: 2610.09624 and 2605.09252 (analysis wording cut call probability from 0.85 to 0.004), 2603.08068, 2605.14038 (a yes/no gate made Llama-3.1-8B answer no every time), 2609.14157, 2606.22528, 2607.25398.
- Metric: tool-call rate on needed-tool tasks must not drop (2609.14157 saw GPT-OSS 20B fall from 94.4% to 72.4% under a wide "tools are optional" line).
- Proof: trigger-wording A/B on the skill, plus a compaction run.
- Flag: the 2605.09252 gate idea needs decision-models-first receipt.

### 5. Flatten the input schemas

- File: [`plugins/webular/src/schemas.ts`](../../plugins/webular/src/schemas.ts).
- Change: top-level fields, one description per field, names that mirror user phrasing, no identifier-style names.
- Papers: 2610.14334 (schema changed selection more than name or description), 2510.00307, 2605.23916 (a renamed field cut selection to 1 to 10%).
- Metric: tool-call rate, then pass rate.
- Proof: change schemas only, rerun the same tasks.

### 6. Shrink and order the tool list

- Files: [`plugins/webular/src/commands.ts`](../../plugins/webular/src/commands.ts), [`src/commands/search.ts`](../../src/commands/search.ts).
- Change: expose about 10 tools by default, fold overlap (map, crawl, feed), and list `research` first.
- Papers: 2609.24161 (4 coarse tools beat fine-grained ones by 16.4%), 2606.30317, 2510.20036, 2605.24660, 2606.16364 (the first-listed tool gained about 72 points).
- Metric: tool-call rate and right-tool rate.
- Proof: bench with 10, 15, and 20 tools exposed, and a swapped-order run.

### 7. Retry a zero-call answer and bind a tool to each state

- Files: [`src/machines/agent.ts`](../../src/machines/agent.ts), [`plugins/webular`](../../plugins/webular) Stop path.
- Change: if an answer has zero webular calls, retry once with a forced tool choice. In each machine state, require its one authorized tool.
- Papers: 2607.20982 (a guardrail recovered 19.9% of failures at 0.5% false positives), 2601.05214, 2608.26197 (reproducibility 1.000, tokens down 15 to 17%), 2608.03327.
- Metric: never-called rate.
- Proof: count zero-call runs and how many the retry converts.
- Flag: any Jev choice here needs decision-models-first receipt.

### 8. Make errors and empty results say what to do next

- Files: [`plugins/webular/src/runtime.ts`](../../plugins/webular/src/runtime.ts), [`src/core/effect.ts`](../../src/core/effect.ts), [`src/workflows/answer.ts`](../../src/workflows/answer.ts), [`src/workflows/research.ts`](../../src/workflows/research.ts).
- Change: name the exact fix and the next tool in every error. On an empty result, return a short directive ("no reliable results; try a different query or answer unknown").
- Papers: 2610.10062, 2601.15625, 2509.25238, 2609.35381 (recovery 45% to 84%), 2606.25819, 2610.05348 (92.5% abstention for a directive, 29.2% for a soft warning).
- Metric: recovery rate after a tool error, then pass rate.
- Proof: inject a rate-limit and an empty result, compare recovery.
- Flag: if Jev decides when to emit the directive, needs decision-models-first receipt.

## Ranked changes for pass rate

### 9. Stop on sufficiency or stagnation

- Files: [`src/machines/agent.ts`](../../src/machines/agent.ts), [`src/lib/jev/decisions/research.ts`](../../src/lib/jev/decisions/research.ts).
- Papers: 2608.02009 (20 to 45% fewer loops, accuracy within 1.5 points), 2608.23623 (0 of 66 premature unsupported stops against 40 of 66), 2608.15191 and 2608.01913 (14 fewer searches), 2605.05701, 2603.19896.
- Metric: pass rate, then loop count.
- Proof: loop count and exact match on the dev set.
- Flag: needs decision-models-first receipt.

### 10. Decompose the question before the first search

- Files: [`src/machines/agent-jev.ts`](../../src/machines/agent-jev.ts), research command.
- Papers: 2609.14412 (BrowseComp-Plus 83.1% to 90.5%), 2607.07548 (planner scaling +11 EM), 2605.28354.
- Metric: pass rate on multi-hop tasks.
- Proof: dev-set multi-hop pass rate.
- Flag: needs decision-models-first receipt.

### 11. Harden `act` grounding

- Files: [`src/lib/cua-ground.ts`](../../src/lib/cua-ground.ts), [`src/lib/cua-ladder.ts`](../../src/lib/cua-ladder.ts), [`src/lib/cua-tree.ts`](../../src/lib/cua-tree.ts), [`src/commands/act.ts`](../../src/commands/act.ts).
- Change: rank the target against its nearest distractors with a top-k verify. Re-check the target just before the click. Shrink and diff the element list. Label page text as untrusted. Return the rungs tried on failure and retry once. Make `act` the last resort in the skill.
- Papers: 2610.13268, 2610.17792 (ScreenSpot-Pro 54.7% to 66.0%), 2603.00476 (100% interception in 180 trials), 2605.00551 (input tokens down to 22%), 2608.08939 (attack success 0.822 on unsanitized trees), 2610.27954, 2607.22798.
- Metric: act pass rate and tokens per run.
- Proof: act dev set before and after.
- Flag: the target pick and any injection classifier need decision-models-first receipt.

### 12. Fit search queries to agent behavior

- File: [`src/commands/search.ts`](../../src/commands/search.ts).
- Papers: 2602.21456, 2605.10848, 2602.05975 (agents send keyword queries; tuned BM25 reached 83.1%), 2601.14224 (moderate reranking beats more reasoning), 2609.05637 and 2609.14885 (need decision-models-first receipt).
- Metric: retrieval hit rate, then pass rate.
- Proof: retrieval hit rate on the dev set.

### 13. Keep the eval honest

- Files: [`tests/models/agent`](../../tests/models/agent).
- Papers: 2605.28721 (44.5% of BrowseComp questions answered without tools), 2606.05241, 2606.22737, 2606.13685, 2607.02577 (one setup scored 57.9 to 76.8% across 23 repeats).
- Change: block benchmark domains, prefer deterministic evidence checks over an LLM judge, repeat runs, pin the judge version, score pass^3.

## AGENTS.md changes

The byte caps are root 12288, [`src/lib`](../../src/lib) 4096, and [`plugins/webular`](../../plugins/webular) 4096. When read, root was 12263, [`src/lib`](../../src/lib) 4084, and [`plugins/webular`](../../plugins/webular) 3952 bytes, so each change must cut as much as it adds. The evidence is mixed: 2607.27250, 2605.10039, and 2602.11988 report small or null success effects, and 2601.20404 shows an efficiency gain only. Keep a change only after a before-and-after bench run.

1. [`AGENTS.md`](AGENTS.md), "Code rules": write rules as "do not X" or as an exact command or path. Papers 2604.11088 (+13.8 points), 2604.20911, 2602.11988, 2610.04832 (+0.23 on required-action rate). Prohibitions decay over a long session (73% at turn 5, 33% at turn 16), so pair each with a check (change 4).
2. [`AGENTS.md`](AGENTS.md), "Project map" and intro: delete what the layout, [`mise.toml`](../../mise.toml), or the README already show. Papers 2602.11988, 2606.15828 (context bloat in 42% of files). This frees bytes for change 1.
3. [`AGENTS.md`](AGENTS.md) size rule and [`tests/quality/agents-md.test.ts`](../../tests/quality/agents-md.test.ts): treat the caps as ceilings, and add a contradiction check per file chain. Papers 2610.11007, 2608.02639, 2510.14842, 2605.10039.
4. [`tests/quality/agents-md.test.ts`](../../tests/quality/agents-md.test.ts): turn each "Never" and "Ask first" line into an executable check where one is feasible. Papers 2603.00822 (88.3% compliance with checks against 67.0% from text alone), 2604.15625.
5. [`AGENTS.md`](AGENTS.md) content rule: add a smell list (lint leakage, context bloat, skill leakage, conflicting instructions). Papers 2606.15828, 2511.12884.
6. [`src/lib/AGENTS.md`](../../src/lib/AGENTS.md) and [`plugins/webular/AGENTS.md`](../../plugins/webular/AGENTS.md): keep about 60 lines of commands and paths, and push detail into child folders. Papers 2610.04832, 2601.20404.

## Done when

- The miss split in change 1 is on file.
- Each change that moves tool-call rate has a before-and-after run.
- Every item marked "needs decision-models-first receipt" has its receipt before code changes.
