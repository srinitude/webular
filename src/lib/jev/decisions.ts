// The registry of Jev decisions for webular's workflows: the one entry the rest
// of src imports. Each decision lives in decisions/ (one file per job) or
// picks.ts, built with defineDecision in define.ts.
import { actDecision } from './decisions/act.ts'
import { answerSentence, answerSources } from './decisions/answer.ts'
import { answerCitation } from './decisions/answer-citation.ts'
import { answerHits } from './decisions/answer-evidence.ts'
import { answerFollowers } from './decisions/answer-sentences.ts'
import { suggestDecision } from './decisions/cli-suggest.ts'
import { linkDecision, linkWorthFollowing } from './decisions/crawl.ts'
import { fieldDecision, recoverDecision } from './decisions/extract.ts'
import { kindDecision, mapDecision, mapOrder } from './decisions/map.ts'
import { changeDecision } from './decisions/monitor.ts'
import { titleDecision } from './decisions/page-title.ts'
import { researchDone, researchPart } from './decisions/research.ts'
import { researchSentence } from './decisions/research-sentences.ts'
import { mainDecision } from './decisions/scrape.ts'
import { searchRank } from './decisions/search.ts'
import { intentDecision } from './decisions/search-intent.ts'
import { coreDecision, summaryDecision } from './decisions/summarize.ts'
import { extractDecision, feedDecision } from './picks.ts'

export const decisions = {
  link: linkDecision,
  links: linkWorthFollowing,
  map: mapDecision,
  change: changeDecision,
  researchPart,
  research: researchDone,
  researchSentence,
  extract: extractDecision,
  feed: feedDecision,
  summary: summaryDecision,
  main: mainDecision,
  searchRank,
  searchIntent: intentDecision,
  cliSuggest: suggestDecision,
  pageTitle: titleDecision,
  act: actDecision,
  answerHits,
  answerSources,
  answerSentence,
  answerFollowers,
  answerCitation,
  extractField: fieldDecision,
  extractRecover: recoverDecision,
  summaryCore: coreDecision,
  mapKind: kindDecision,
  mapOrder,
}
