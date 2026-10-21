// Cost per decision step stays flat as input grows. Each decision's sample is
// scaled 10x and 100x (strings repeat, lists grow), then one step runs on a fake
// Jev that counts requests and cache entries. Flat means bounded by a constant:
// payload chars stay under the byte cap, reads of the input stop growing once
// the caps bite, and every step sends the same number of requests.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { JEV_MODEL_DEFAULT, Jev, type JevRequest } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { CAPS, cacheKey, noul, purpose, requestBytes } from '../../src/lib/jev/payload/index.ts'
import { counted, newCount, total } from './work-count.ts'

interface Step {
  readonly def: { readonly payload: (i: never) => JevRequest; readonly sample: () => unknown }
  (i: never): Effect.Effect<unknown, unknown, Jev>
}

const scale = (v: unknown, k: number): unknown => {
  if (typeof v === 'string') return v.repeat(k)
  if (Array.isArray(v))
    return Array.from({ length: v.length * k }, (_, i) => scale(v[i % v.length], k))
  if (typeof v !== 'object' || v === null || Object.isFrozen(v)) return v
  if (Object.getPrototypeOf(v) !== Object.prototype) return v
  return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, scale(x, k)]))
}

// A fake Jev: no answers (so every step keeps its fallback), one cache entry
// per distinct canonical body, and a count of every request it gets.
const fakeJev = () => {
  const cache = new Map<bigint, string>()
  let requests = 0
  const service = Jev.of({
    available: true,
    ask: (_decision, req) =>
      Effect.sync(() => {
        requests++
        const body = requestBytes(JEV_MODEL_DEFAULT, req.state, req.questions)
        cache.set(cacheKey(body), body)
        return { answers: {}, inputTokens: 0 }
      }),
  })
  return { service, stats: () => ({ requests, entries: cache.size }) }
}

const costAt = (step: Step, k: number) => {
  const input = scale(step.def.sample(), k) as never
  const work = newCount()
  const req = step.def.payload(counted(input, work))
  const chars = requestBytes(JEV_MODEL_DEFAULT, req.state, req.questions).length
  const jev = fakeJev()
  Effect.runSync(Effect.ignore(step(input)).pipe(Effect.provideService(Jev, jev.service)))
  return { chars, reads: total(work), ...jev.stats() }
}

// Ten times the input may at most double the input reads between 10x and 100x;
// a linear builder grows them about 10x. Chars and requests have fixed caps.
const flatness = (step: Step) => {
  const [x1, x10, x100] = [1, 10, 100].map((k) => costAt(step, k))
  const ok =
    x1 !== undefined &&
    x10 !== undefined &&
    x100 !== undefined &&
    x100.chars <= CAPS.bytes + 1_024 &&
    x100.reads <= 2 * Math.max(x10.reads, 1) &&
    x100.requests === x1.requests &&
    x100.requests <= 2 &&
    x100.entries <= x100.requests
  return { ok, x1, x10, x100 }
}

// Every decision whose definition carries a payload builder and a sample.
const steps = Object.entries(decisions as unknown as Record<string, Partial<Step>>).filter(
  (e): e is [string, Step] =>
    typeof e[1].def?.payload === 'function' && typeof e[1].def.sample === 'function',
)

for (const [name, step] of steps)
  test(`${name}: cost per step stays flat at 10x and 100x input`, () => {
    const r = flatness(step)
    expect({ name, ...r }).toMatchObject({ name, ok: true })
  })

// A deliberately linear builder: it copies every item into the payload, so its
// input reads grow with the list. The check must reject it.
const P = purpose('m', 'o', 'w', 'b')
type Items = { readonly items: ReadonlyArray<{ readonly text: string }> }
const linearDef = {
  payload: (i: Items): JevRequest => ({
    state: { purpose: P, items: i.items.map((x) => ({ text: x.text })) },
    questions: { q: noul('Is `items` useful?') },
  }),
  sample: (): Items => ({ items: Array.from({ length: 30 }, () => ({ text: 'y' })) }),
}
const linearStep = Object.assign(
  (i: Items) =>
    Effect.gen(function* () {
      const jev = yield* Jev
      return yield* jev.ask('linear', linearDef.payload(i))
    }),
  { def: linearDef },
) as unknown as Step

test('the flatness check rejects a linear payload builder', () => {
  expect(flatness(linearStep).ok).toBe(false)
})

test('one step makes one cache entry, and a repeat makes no new one', () => {
  const step = decisions.link as unknown as Step
  const input = scale(step.def.sample(), 100) as never
  const jev = fakeJev()
  const run = Effect.ignore(step(input)).pipe(Effect.provideService(Jev, jev.service))
  Effect.runSync(Effect.andThen(run, run))
  expect(jev.stats()).toEqual({ requests: 2, entries: 1 })
})
