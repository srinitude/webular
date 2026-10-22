# tests/jev/fixtures/AGENTS.md

This folder holds the images the Jev image tests send, and it follows [tests/jev/AGENTS.md](../AGENTS.md).

- [`bar-chart-320.png`](bar-chart-320.png) is a 320-pixel bar chart. [`tests/jev/crop-box.test.ts`](../crop-box.test.ts) and the eval cases in [`tests/jev/evals/chart.crop-box.json`](../evals/chart.crop-box.json) use it.
- The images are fixed inputs. Change an image only together with the tests and eval cases that use it.
