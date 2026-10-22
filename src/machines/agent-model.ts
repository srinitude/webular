// The Stately agent's model: WEBULAR_AGENT_MODEL names `jev:<released Jev id>`.
// Jev is the only provider; its key comes from the shared Jev client (TYPESAFE_API_KEY,
// then the macOS Keychain) through ./agent-jev.ts.
import { Config, Effect, Option } from 'effect'

interface ModelRef {
  provider: 'jev'
  id: string
}

// `jev:model` into a model reference, or none for any other shape.
export const parseModel = (value: string): Option.Option<ModelRef> =>
  value.startsWith('jev:') && value.length > 4
    ? Option.some({ provider: 'jev', id: value.slice(4) })
    : Option.none()

// The model when WEBULAR_AGENT_MODEL parses, else none.
export const modelRef = Config.option(Config.String('WEBULAR_AGENT_MODEL')).pipe(
  Effect.map(Option.flatMap(parseModel)),
  Effect.orElseSucceed(() => Option.none<ModelRef>()),
)

export const load = <A>(importer: () => Promise<A>) =>
  Effect.tryPromise({ try: importer, catch: (cause) => cause })
