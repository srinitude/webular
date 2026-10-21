// Turns Wikidata facts into answer tasks: short, citation, false-premise, no-answer.

import type { Fact, Lang } from './generate-answer-wikidata.ts'
import { AUTHOR, BUILD_DATE, CANARY, type Task } from './generate-common.ts'

const FRAME: Record<Lang, (p: string, i: string) => string> = {
  en: (p, i) => `What is the ${p} of ${i}?`,
  zh: (p, i) => `${i}的${p}是什么？`,
  ko: (p, i) => `${i}의 ${p}은(는) 무엇입니까?`,
  ja: (p, i) => `${i}の${p}は何ですか？`,
  de: (p, i) => `Was ist ${p} von ${i}?`,
  fr: (p, i) => `Quel est ${p} de ${i} ?`,
  es: (p, i) => `¿Cuál es ${p} de ${i}?`,
}

export const LONG_TAIL_SITELINKS = 10
const wd = (qid: string) => `https://www.wikidata.org/wiki/${qid}`

export interface Pick {
  readonly fact: Fact
  readonly domain: string
  readonly prop: string
  readonly propLabel: string
  readonly lang: Lang
}

const base = (id: string, p: Pick, questionType: string, premise: string) => ({
  id,
  family: 'answer',
  author: AUTHOR,
  buildDate: BUILD_DATE,
  canary: CANARY,
  questionType,
  source: { url: wd(p.fact.qid), asOf: BUILD_DATE, license: 'CC0-1.0' },
  tags: {
    domain: p.domain,
    language: p.lang,
    fresh: false,
    longTail: p.fact.sitelinks <= LONG_TAIL_SITELINKS,
    ambiguous: p.fact.values.length > 1,
    premise,
  },
})

const evidence = (p: Pick) =>
  p.fact.values.map((v) => ({ url: wd(p.fact.qid), span: `${p.propLabel}: ${v.label}` }))

export const factTask = (p: Pick, mode: 'short' | 'citation'): Task => {
  const answers = p.fact.values.map((v) => v.label)
  return {
    ...base(`answer.${mode}.${p.fact.qid}.${p.prop}.${p.lang}`, p, `answer.${mode}`, 'none'),
    input: {
      question: FRAME[p.lang](p.propLabel, p.fact.label),
      requireCitation: mode === 'citation',
    },
    gold: { answers, acceptAny: answers.length > 1, evidence: evidence(p) },
    aliases: [...answers, ...p.fact.values.map((v) => v.qid)],
  }
}

export const falsePremiseTask = (p: Pick, wrong: string): Task => {
  const answers = p.fact.values.map((v) => v.label)
  return {
    ...base(`answer.false-premise.${p.fact.qid}.${p.prop}`, p, 'answer.false-premise', 'false'),
    input: { question: `Why is ${wrong} the ${p.propLabel} of ${p.fact.label}?` },
    gold: { answers, falseClaim: wrong, rejectPremise: true, evidence: evidence(p) },
    aliases: [...answers, ...p.fact.values.map((v) => v.qid)],
  }
}

export const noAnswerTask = (p: Pick): Task => ({
  ...base(`answer.no-answer.${p.fact.qid}.${p.prop}`, p, 'answer.no-answer', 'no-answer'),
  input: { question: FRAME.en(p.propLabel, p.fact.label) },
  gold: {
    answers: [],
    noAnswer: true,
    evidence: [{ url: wd(p.fact.qid), span: `${p.propLabel}: no value` }],
  },
  aliases: ['no value', 'none'],
})

// Interleaves the least and the most linked items so long-tail entities get a fair share.
export const interleave = (facts: ReadonlyArray<Fact>): Array<Fact> => {
  const sorted = [...facts].sort((a, b) => a.sitelinks - b.sitelinks || a.qid.localeCompare(b.qid))
  const out: Array<Fact> = []
  for (let lo = 0, hi = sorted.length - 1; lo <= hi; lo++, hi--) {
    out.push(...sorted.slice(lo, lo + 1))
    if (hi !== lo) out.push(...sorted.slice(hi, hi + 1))
  }
  return out
}
