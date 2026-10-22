# tests/fixtures/html/AGENTS.md

This folder holds stored HTML pages for the page-parsing tests, and it follows [tests/fixtures/AGENTS.md](../AGENTS.md).

- [`image-report.html`](image-report.html) is a report page with images. [`tests/engine/html.test.ts`](../../engine/html.test.ts) reads it.
- [`extract-product.html`](extract-product.html), [`extract-article.html`](extract-article.html), and [`extract-recipe.html`](extract-recipe.html) are pages with schema.org markup and known field values. [`tests/commands/extract-accuracy.test.ts`](../../commands/extract-accuracy.test.ts) reads them.
- The pages are fixed inputs. Change a page only together with the test that reads it.
