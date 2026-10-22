// bun scripts/bench/tasks/generate-fresh.ts: builds the fresh tasks
// (search.fresh from arXiv and Wikipedia, answer.short from Wikidata) and
// writes bench/tasks/{dev,test,private}/fresh.jsonl.
import { Console, Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { writeSets } from './generate-common.ts'
import { arxivTasks } from './generate-fresh-arxiv.ts'
import { wikidataTasks } from './generate-fresh-wikidata.ts'
import { wikipediaTasks } from './generate-fresh-wikipedia.ts'

const root = `${import.meta.dir}/../../..`

const program = Effect.gen(function* () {
  const [arxiv, wiki, answers] = yield* Effect.all([arxivTasks, wikipediaTasks, wikidataTasks], {
    concurrency: 3,
  })
  const tasks = [...arxiv, ...wiki, ...answers]
  yield* writeSets(root, 'fresh', tasks)
  yield* Console.log(
    `fresh: arxiv ${arxiv.length}, wikipedia ${wiki.length}, wikidata ${answers.length}`,
  )
})

Effect.runPromise(program.pipe(Effect.provide(FetchHttpClient.layer)))
