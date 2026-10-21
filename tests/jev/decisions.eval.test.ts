// Eval: each Jev decision against its deterministic baseline on labeled cases.
// Code scorer: exact match to the label. Keep rule: Jev stays only if its pass
// rate holds or rises over the baseline. Runs live when a TypeSafe key resolves.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Clock, Config, Effect, FileSystem, Layer, ManagedRuntime, Option } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'

// Each baseline is the decision's own rule-based fallback.
const linkBaseline = (l: { url: string; anchor: string }) =>
  decisions.link.def.fallback({ goal: '', page: { url: '', title: '' }, link: l })
const changeBaseline = (diff: string) =>
  decisions.change.def.fallback({ url: '', watchFor: '', diff })
const changeMatters = (url: string, watchFor: string, diff: string) =>
  decisions.change({ url, watchFor, diff })
const { links: linkWorthFollowing, research: researchDone } = decisions
const researchBaseline = researchDone.baseline

const rt = ManagedRuntime.make(Jev.live)
const page = { url: 'https://docs.example.dev/', title: 'Example docs' }
const goal = 'how to configure the Example CLI'
const links: Array<[string, string, boolean]> = [
  ['https://docs.example.dev/config', 'Configuration', true],
  ['https://docs.example.dev/cli/flags', 'CLI flags reference', true],
  ['https://docs.example.dev/login', 'Sign in', false],
  ['https://docs.example.dev/privacy', 'Privacy policy', false],
  ['https://twitter.com/intent/tweet?url=x', 'Share on X', false],
  ['https://docs.example.dev/blog/company-picnic', 'Our company picnic', false],
  ['https://docs.example.dev/careers', 'We are hiring', false],
  ['https://docs.example.dev/install', 'Install', true],
  ['https://docs.example.dev/edit-on-github?file=config.md', 'Edit this page', false],
  ['https://docs.example.dev/tag/config', 'config', false],
]
const diffs: Array<[string, boolean]> = [
  ['-Updated 2026-10-20 09:14\n+Updated 2026-10-21 08:02', false],
  ['-Views: 10,422\n+Views: 10,977', false],
  ['-Price: $49 per month\n+Price: $59 per month', true],
  ['-Status: in stock\n+Status: sold out', true],
  ['-Session id abc123\n+Session id f9e8d7', false],
  ['-Sponsored: Try BrandX today\n+Sponsored: Try BrandY now', false],
  [
    '-The API rate limit is 100 requests per minute.\n+The API rate limit is 20 requests per minute.',
    true,
  ],
  ['-Copyright 2025\n+Copyright 2026', false],
]
const sub = (question: string, bestEvidence: string) => ({ question, bestEvidence })
const research = [
  {
    s: {
      topic: 'SQLite in Bun',
      round: 1,
      maxRounds: 3,
      subQuestions: [
        sub('Which module gives SQLite in Bun?', 'Bun ships bun:sqlite, a built-in SQLite driver.'),
        sub(
          'Does it support prepared statements?',
          'db.prepare() returns a Statement with run, get, and all.',
        ),
      ],
    },
    done: true,
  },
  {
    s: {
      topic: 'SQLite in Bun',
      round: 1,
      maxRounds: 3,
      subQuestions: [
        sub('Which module gives SQLite in Bun?', 'Bun ships bun:sqlite.'),
        sub('Does it support WAL mode?', 'Bun is a fast JavaScript runtime.'),
      ],
    },
    done: false,
  },
  {
    s: {
      topic: 'Turndown',
      round: 2,
      maxRounds: 3,
      subQuestions: [sub('Who maintains Turndown?', 'Turndown converts HTML to Markdown.')],
    },
    done: false,
  },
  {
    s: {
      topic: 'Turndown',
      round: 2,
      maxRounds: 3,
      subQuestions: [
        sub('Who maintains Turndown?', 'Turndown is maintained by Dom Christie on GitHub.'),
      ],
    },
    done: true,
  },
]

const rate = (hits: ReadonlyArray<boolean>) => hits.filter(Boolean).length / hits.length

const askAll = Effect.gen(function* () {
  const linkJev = yield* linkWorthFollowing(
    goal,
    page,
    links.map(([url, anchor]) => ({ url, anchor })),
  )
  const changeJev = yield* Effect.forEach(
    diffs,
    ([d]) => changeMatters('https://shop.example/item', '', d),
    { concurrency: 8 },
  )
  const doneJev = yield* Effect.forEach(research, (r) => researchDone(r.s), { concurrency: 4 })
  return [linkJev, changeJev, doneJev] as const
})

const scoreRows = (
  linkJev: ReadonlyArray<boolean>,
  changeJev: ReadonlyArray<boolean>,
  doneJev: ReadonlyArray<boolean>,
) => ({
  link: {
    jev: rate(linkJev.map((v, i) => v === links[i]?.[2])),
    base: rate(links.map(([url, anchor, want]) => linkBaseline({ url, anchor }) === want)),
  },
  change: {
    jev: rate(changeJev.map((v, i) => v === diffs[i]?.[1])),
    base: rate(diffs.map(([d, w]) => changeBaseline(d) === w)),
  },
  done: {
    jev: rate(doneJev.map((v, i) => v === research[i]?.done)),
    base: rate(research.map((r) => researchBaseline(r.s) === r.done)),
  },
})

test(
  'jev decisions hold or beat their baselines',
  () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { available } = yield* Jev
        // Model drift (lines in WEBULAR_JEV_DRIFT_FILE, written by the client)
        // makes this a required live calibration rerun: no key fails it, and a
        // pass clears the flag.
        const fs = yield* FileSystem.FileSystem
        const driftFile = yield* Config.option(Config.String('WEBULAR_JEV_DRIFT_FILE'))
        const drifted = Option.isSome(driftFile)
          ? (yield* fs.readFileString(driftFile.value).pipe(Effect.orElseSucceed(() => ''))).trim()
          : ''
        const started = yield* Clock.currentTimeMillis
        const jevAnswers = yield* askAll
        const ms = (yield* Clock.currentTimeMillis) - started
        const rows = scoreRows(...jevAnswers)
        yield* Effect.logInfo(JSON.stringify({ jevAvailable: available, totalMs: ms, rows }))
        // In CI a missing key (and no replay store) fails: a live eval that
        // tests nothing must never pass.
        const ci = Option.isSome(yield* Config.option(Config.String('CI')))
        if (!available && drifted) return expect('model drifted: rerun with a key').toBe('rerun')
        if (!available)
          return expect(ci ? 'no Jev key or replay store in CI' : 'local').toBe('local')
        for (const r of Object.values(rows)) expect(r.jev).toBeGreaterThanOrEqual(r.base)
        if (drifted && Option.isSome(driftFile))
          yield* fs.writeFileString(driftFile.value, '').pipe(Effect.ignore)
      }).pipe(Effect.provide(BunServices.layer)),
    ),
  60_000,
)

test('without a key every decision falls back to its baseline', () => {
  const off = Layer.succeed(Jev, Jev.of({ available: false, ask: () => Effect.die('unused') }))
  const diff = diffs[0]?.[0] ?? ''
  return Effect.runPromise(
    changeMatters('u', '', diff).pipe(
      Effect.provide(off),
      Effect.map((got) => expect(got).toBe(changeBaseline(diff))),
    ),
  )
})
