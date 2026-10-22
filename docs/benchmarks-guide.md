# How to read the benchmarks

This page explains every word and number type used on the benchmark pages. Read it first if you do not work with software tests. It needs no other page.

## What was measured, and why

Webular is a command-line tool that finds and reads web pages for you and for AI agents. Paid services do the same work: Exa, Tavily, Firecrawl, Perplexity, and others. The benchmark gives each tool the same small set of web jobs and checks each result against a known right answer. It answers three questions:

- **Is it right?** How often does each tool get the answer right?
- **Is it fast?** How long does each tool make you wait?
- **What does it cost?** How much does each call cost, and does it need a paid key?

This matters because a tool that is cheap but wrong, or right but slow, is a poor choice. The pages show losses as plainly as wins.

## How to read a score

- Most scores run from **0 to 1**. A score of 1 means every answer was right. A score of 0 means none were. A score of 0.5 means half were right. Scores show three or four decimal places, so small differences stay visible.
- The task sets are small, often 1 to 7 tasks per job. One task more or less right moves a score a lot. So treat a difference as a sign, not as proof.
- A missing score is never a zero. It means the tool did not run that job.

## Words about the test itself

- **Task:** one question or web job with a known right answer, such as "find the home page of this group".
- **Gold answer:** the known right answer for a task. A **grader** is the code that compares a tool's answer with the gold answer.
- **Run:** one attempt at one task. A task can run more than once, and the report says how many runs each task got. Each run is graded on its own.
- **Job (command):** a kind of work. `search` finds pages. `scrape` reads one page. `crawl` follows links across a site. `map` lists a site's pages. `extract` pulls set fields out of a page. `answer` gives a short answer to a question. `research` writes a longer answer with sources. `summarize` shortens a page. `batch` reads many pages at once. `monitor` spots a change on a page. `parse` reads a document file. `media` takes a picture of a page. `act` clicks and types on a page to reach a goal.
- **Tool, peer, or rival:** another service that does the same job. A tool's **adapter** is the small piece of code that sends it the tasks.
- **Harness:** the test program that runs every tool on every task and records the results.
- **Shared tasks:** the tasks that both webular and one rival answered. A fair head-to-head uses only these.
- **Seed:** a fixed starting number that makes the task order repeat the same way each time.
- **Recordings and replay:** the harness saves each live answer. A replay reads the saved answers, so it costs nothing and gives the same numbers each time. A **live run** calls the paid services again.
- **sha256:** a fingerprint of a file. If the file changes, the fingerprint changes.

## Row status words

Each tool, task, and run makes one row with one status:

- **ok:** the tool answered, and the answer was graded.
- **error:** the tool failed, for example it timed out.
- **unsupported:** the tool has no way to do that job.
- **skipped:** the tool was not run, most often because no key was set.
- **unrecorded:** no saved answer exists for that row, so a replay cannot score it.

## Quality measures

- **Accuracy:** the share of answers graded right, from 0 to 1. One run counts as right only when it passes every check its task sets. **Mean accuracy** first averages each task over its runs, then averages across tasks.
- **Success rate:** the share of calls that came back with status `ok` rather than `error`, from 0 to 1. A wrong answer still counts as a success here.
- **Determinism:** of the tasks that ran more than once, the share where every run gave the exact same output, from 0 to 1. Higher means steadier.
- **Citation precision:** for answers that list sources, the share of listed sources whose text holds an accepted right answer.
- **Precision:** of the pages or items a tool returned, the share that were right.
- **Recall:** of the right pages or items, the share the tool found. **Key-fact recall** is the share of known key facts a summary kept.
- **F1:** one number that blends precision and recall. It is high only when both are high.
- **hit@1 and hit@10:** whether the right page is the first search result (hit@1) or in the top ten (hit@10).
- **Leak:** the share of page clutter, such as menus and footers, that slipped into a scraped page. Lower is better.
- **Script pages routed to browser:** the share of pages that need a real browser to show their text that webular sent to one.
- **Robustness:** how well a command copes with broken or hostile pages.
- **Test pass rate:** the share of a command's own tests that pass. **Jev eval pass rate** is the same for Jev's checks.
- **ROUGE-1 F1 and ROUGE-2 F1:** how much a summary's words (ROUGE-1) or word pairs (ROUGE-2) overlap a reference summary, from 0 to 1. **Oracle ROUGE-1** is the best ROUGE-1 that any pick of the page's own sentences could reach, a ceiling for comparison.
- **Faithfulness and citation faithfulness:** the share of claims that the page, or the cited source, really supports. **Coverage** is the share of the page's key points a summary includes.
- **No-answer rate:** the share of questions where the tool gave no answer at all. Lower is better unless no answer was right.

## Speed and cost measures

- **Latency:** how long you wait for an answer. It is in **ms**, short for milliseconds. One ms is a thousandth of a second, so 1000 ms is one second.
- **p50 (median wait):** half of the calls finished faster than this, and half slower. It is the typical wait. Every call has a 60 second limit, and a call that fails counts as a full 60 second wait.
- **p95 (slow-case wait):** 95 of every 100 calls finished faster than this. It shows the bad days.
- **Cold and warm calls:** a cold call is the first one, before anything is saved or loaded. A warm call reuses saved work and is often faster. Mixing them can make a tool look faster or slower than it is.
- **Cost per call (USD):** the money each call costs, in U.S. dollars. **Cost per success** divides the cost by the calls that were right.
- **Keys needed:** how many paid accounts or API keys you must set up before the tool works. An **API key** is a secret password for a paid service.
- **Offline:** the tool can run with no paid service on the internet behind it.

## Agent words

- **Agent:** an AI model that decides which tool to call and then writes the answer. An **agent model** is the AI model behind it, such as `claude-opus-5-5`.
- **Agent matrix:** a grid with one line per agent model and one entry per tool. Each entry is a **cell**, and each tool choice is an **arm**.
- **Jev on and Jev off:** Jev is a small decision model from TypeSafe that webular can use for judgment calls. "Jev on" runs webular with it, and "Jev off" runs it without.
- **No tool call:** a run where the agent never called the tool, so no graded answer came back.
- **Sure-but-wrong:** a run where the agent gave a graded answer that was wrong.
- **Tokens:** the units of text, about three quarters of a word each, that an AI model reads and writes. AI bills are counted in tokens.
- **Tool calls:** how many times the agent called the tool in one run, as an average.

## Scoreboard words

- **gap:** no test measures this metric yet. It is not a zero. On these pages, "gap" means only this. When one score is higher than another, the pages call that a "difference".
- **ceiling below 1:** the best score this method can reach is under 1, for a known reason. The score is not expected to reach 1.
- **peer dev:** the number comes from the peer run against rivals.
- **dev:** the number comes from webular's own offline tests on saved pages.
- **Best rival:** the rival with the highest value on the same metric.

## Words about how sure we can be

- **Noise:** random ups and downs between runs. With small task sets, noise can look like a real difference.
- **Noise bar:** the size below which a difference counts as noise. For speed it is the larger of two bootstrap SEs and 10 ms. **On par** means webular's accuracy is at least the rival's, and its p50 is within the noise bar or behind only for a written, proven reason.
- **Confidence interval:** a range that likely holds the true score. The results file has none, so the pages give none.
- **Bootstrap SE (standard error):** a way to estimate how far a score could move from noise alone, by re-sampling the results many times. The pages report none.
- **p value and paired test:** math that checks whether a difference between two tools is likely real. A paired test compares both tools on the same tasks. The results file has none, so no win or loss is called proven.
- **ABBA order:** running two versions in the order A, B, B, A so that a slow start or end does not favor one. It covers only webular's own code versions here.
- **Bias:** a flaw in the test that tilts results toward one tool. The [method page](benchmarks-method.md) lists the known ones.

Return to [the benchmark report](benchmarks.md) (navigation only).
