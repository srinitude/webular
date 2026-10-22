// SCRAPE command entry — invoked by `mise run run:scrape`. Parses flags,
// runs the Mastra scrape workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const RENDERERS = ['agent-browser', 'cua', 'off']

const renderFlag = (render: string | undefined) =>
  render === undefined || RENDERERS.includes(render)
    ? Effect.succeed(render)
    : Effect.fail(
        new CliError({
          message: 'scrape: --render must be agent-browser, cua, or off',
          exitCode: EXIT.usage,
        }),
      )

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    archive: { type: 'boolean' },
    render: { type: 'string' },
    'ignore-robots': { type: 'boolean' },
  })
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    return yield* new CliError({ message: 'scrape: missing --url <url>', exitCode: EXIT.usage })
  }
  const render = yield* renderFlag(values['render'] as string | undefined)
  const inputData = {
    url,
    timeoutMs: yield* timeoutFlag('scrape', values),
    archive: values['archive'] === true,
    ignoreRobots: values['ignore-robots'] === true,
    ...(render ? { render } : {}),
  }
  return yield* runWorkflow(
    'scrape',
    () => import('../workflows/scrape.ts'),
    (m) => m.scrapeWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
