// Peers that need a cost, a card, or a cloud project the user has not approved.
// Each is listed with no jobs, so the report shows it as skipped, never faked.
import type { Provider } from './model.ts'

const waiting = (id: string, why: string): Provider => ({
  id,
  local: false,
  keyNames: [`${id}-api-key`],
  jobs: {},
  skip: `awaiting approval: ${why}`,
})

export const awaitingApproval: readonly Provider[] = [
  waiting('openai-web-search', '$10 per 1,000 calls'),
  waiting('anthropic-web', 'web search $10 per 1,000 searches, plus web fetch'),
  waiting('vertex-grounding', 'needs a Google Cloud project'),
  waiting('bing-grounding', 'needs an Azure AI Foundry project'),
  waiting('zyte', 'a card is required'),
  waiting('spider', 'pay as you go from $1'),
]
