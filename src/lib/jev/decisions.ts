// The registry of Jev decisions for webular's workflows: the one entry the rest
// of src imports. Each decision lives in decisions/ (one file per job) or
// picks.ts, built with defineDecision in define.ts.
import { actDecision } from './decisions/act.ts'
import { answerSentence, answerSources } from './decisions/answer.ts'
import { answerCitation } from './decisions/answer-citation.ts'
import { answerHits } from './decisions/answer-evidence.ts'
import { linkDecision, linkWorthFollowing } from './decisions/crawl.ts'
import { fieldDecision, recoverDecision } from './decisions/extract.ts'
import { kindDecision, mapDecision, mapOrder } from './decisions/map.ts'
import { changeDecision } from './decisions/monitor.ts'
import { researchDone, researchPart } from './decisions/research.ts'
import { mainDecision } from './decisions/scrape.ts'
import { searchFit, searchRank, searchRoute } from './decisions/search.ts'
import { coreDecision, summaryDecision } from './decisions/summarize.ts'
import { extractDecision, feedDecision } from './picks.ts'

export const decisions = {
  link: linkDecision,
  links: linkWorthFollowing,
  map: mapDecision,
  change: changeDecision,
  researchPart,
  research: researchDone,
  extract: extractDecision,
  feed: feedDecision,
  summary: summaryDecision,
  main: mainDecision,
  searchRoute,
  searchFit,
  searchRank,
  act: actDecision,
  answerHits,
  answerSources,
  answerSentence,
  answerCitation,
  extractField: fieldDecision,
  extractRecover: recoverDecision,
  summaryCore: coreDecision,
  mapKind: kindDecision,
  mapOrder,
}
