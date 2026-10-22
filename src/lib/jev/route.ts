// Which way webular reaches Jev, in a fixed order:
//   1. WEBULAR_JEV=off: no route, every decision uses its baseline.
//   2. The direct key (TYPESAFE_API_KEY, then the macOS Keychain item) at
//      TYPESAFE_BASE_URL, or the TypeSafe API when that is unset. A same-shape
//      proxy, such as LiteLLM's `{proxy}/typesafe` pass-through, goes here too.
//   3. The gateway keys, in GATEWAYS order.
// Every route takes TypeSafe's own request and returns TypeSafe's own reply
// (client.ts posts it), and lists models at <base>/v1/models. Keys stay Redacted.
import { Config, Effect, Option, type Redacted } from 'effect'

export const TYPESAFE_BASE = 'https://api.typesafe.ai'

export interface JevRoute {
  readonly name: 'typesafe' | 'pydantic'
  readonly base: string
  readonly key: Redacted.Redacted<string>
}

// Same-shape pass-through gateways, tried in this order when no direct key is set.
// Each forwards TypeSafe's body unchanged, so the model id stays the versioned
// TypeSafe id. Pydantic: pydantic.dev/articles/jev-pydantic-ai-gateway.
// Vercel is left out: its docs name only the alias `typesafe-ai/jev`, and no
// versioned id, so webular cannot pin its released model there.
export const GATEWAYS = [
  {
    name: 'pydantic',
    env: 'PYDANTIC_AI_GATEWAY_API_KEY',
    base: 'https://gateway-us.pydantic.dev/proxy/typesafe',
  },
] as const

export const modelsUrl = (r: JevRoute) => `${r.base}/v1/models`

const optional = <A, E, R>(eff: Effect.Effect<Option.Option<A>, E, R>) =>
  eff.pipe(Effect.orElseSucceed(() => Option.none<A>()))
const setting = (name: string) => optional(Config.option(Config.String(name)))
const secret = (name: string) => optional(Config.option(Config.Redacted(name)))
const nonEmpty = Option.filter((s: string) => s.trim().length > 0)

// `direct` is the TypeSafe key lookup; it runs only when Jev is on.
export const resolveRoute = <R>(
  direct: Effect.Effect<Option.Option<Redacted.Redacted<string>>, never, R>,
) =>
  Effect.gen(function* () {
    if (Option.contains(yield* setting('WEBULAR_JEV'), 'off')) return Option.none<JevRoute>()
    const key = yield* direct
    if (Option.isSome(key)) {
      const base = nonEmpty(yield* setting('TYPESAFE_BASE_URL')).pipe(
        Option.map((b) => b.trim().replace(/\/+$/, '')),
        Option.getOrElse(() => TYPESAFE_BASE),
      )
      return Option.some<JevRoute>({ name: 'typesafe', base, key: key.value })
    }
    for (const g of GATEWAYS) {
      const k = yield* secret(g.env)
      if (Option.isSome(k))
        return Option.some<JevRoute>({ name: g.name, base: g.base, key: k.value })
    }
    return Option.none<JevRoute>()
  })
