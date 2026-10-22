# tests/fixtures/driver/AGENTS.md

This folder holds the browser back end output that driver tests replay, and it follows [tests/fixtures/AGENTS.md](../AGENTS.md).

- The text and JSON files are recorded stdout from the `agent-browser` and `cua-driver` back ends.
- [`spa-shell.html`](spa-shell.html) is a page shell that needs JavaScript to show its text. [`attention.pdf`](attention.pdf) is a PDF that a test serves to the scrape PDF route.
- [`tests/engine/driver.test.ts`](../../engine/driver.test.ts) and [`tests/machines/scrape-fallback.test.ts`](../../machines/scrape-fallback.test.ts) read these files. No test starts a browser.
- Do not edit the recorded output by hand. Record the back end again when its output changes.
