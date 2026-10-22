// The MCP tool inputs offer only values the CLI accepts: scrape's render and
// ignoreRobots match the scrape workflow input, and search's source list is
// the CLI's SEARCH_SOURCES minus the ones left out on purpose. Reads the real
// schemas, so a value added on one side fails here until the other follows.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { z } from 'zod'
import { schemas } from '../../plugins/webular/src/schemas.ts'
import { SEARCH_SOURCES } from '../../src/lib/search-source-names.ts'
import { scrapeWorkflow } from '../../src/workflows/scrape.ts'
import { eff } from '../_support/run.ts'

const BUDGET = 'The tools/list token budget (tests/commands/tokens.test.ts) leaves no room for it.'
const NOT_ON_MCP_SOURCE: Record<string, string> = {
  npm: BUDGET,
  marginalia: 'Searched only when a caller names it, which an agent seldom does.',
  'github-search': BUDGET,
}

const optionsOf = (field: z.ZodType) =>
  ((field as z.ZodOptional<z.ZodEnum>).unwrap().options as string[]).slice().sort()

test(
  "scrape's render values and ignoreRobots input are the scrape workflow's",
  eff(
    Effect.sync(() => {
      const wf = (scrapeWorkflow.inputSchema as z.ZodObject).shape
      const tool = schemas.scrape.shape
      expect(optionsOf(tool.render)).toEqual(optionsOf(wf['render'] as z.ZodType))
      expect(Object.keys(tool).sort()).toEqual(
        Object.keys(wf)
          .filter((k) => k !== 'timeoutMs')
          .sort(),
      )
    }),
  ),
)

test(
  "search's source values are the CLI's, except the recorded ones",
  eff(
    Effect.sync(() => {
      const offered = optionsOf(schemas.search.shape.source)
      expect(offered.filter((s) => !(SEARCH_SOURCES as readonly string[]).includes(s))).toEqual([])
      const left: string[] = SEARCH_SOURCES.filter((s) => !offered.includes(s))
      expect(left.sort()).toEqual(Object.keys(NOT_ON_MCP_SOURCE).sort())
    }),
  ),
)
