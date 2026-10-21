// Proves the human-language skill's word rules: for each eval case, plain.ts
// finds nothing in the stored good text and exactly the named issues in the bad.
import { expect, test } from 'bun:test'
import file from '../skills/human-language/evals/evals.json' with { type: 'json' }
import { proseIssues } from '../skills/human-language/scripts/plain.ts'

const check = (id: string) => {
  const found = file.evals.find((c) => c.id === id)
  expect(found).toBeDefined()
  if (!found) return
  expect(proseIssues(found.good)).toEqual([])
  expect(proseIssues(found.bad)).toEqual(found.bad_issues)
}

test('human-language eval rewrite-mcp-scrape-tool-description passes plain.ts', () =>
  check('rewrite-mcp-scrape-tool-description'))
test('human-language eval write-cli-help-for-map-command passes plain.ts', () =>
  check('write-cli-help-for-map-command'))
test('human-language eval write-jev-payload-question-text passes plain.ts', () =>
  check('write-jev-payload-question-text'))
test('human-language eval rewrite-schema-field-description-limit passes plain.ts', () =>
  check('rewrite-schema-field-description-limit'))
test('human-language eval report-partial-crawl-result-honestly passes plain.ts', () =>
  check('report-partial-crawl-result-honestly'))
test('human-language eval leave-fixed-wording-and-quote-alone passes plain.ts', () =>
  check('leave-fixed-wording-and-quote-alone'))
