// The Stately agent's model: WEBULAR_AGENT_MODEL names `provider:model`
// (`anthropic:claude-haiku-5-5`, `openai:gpt-4o-mini`, `jev:<released Jev id>`), and that
// provider's key comes only from the environment, except Jev's, which may also
// come from the macOS Keychain (./agent-jev.ts). The provider package loads lazily.
import { Config, Effect, Option } from 'effect'

const present = (name: string) =>
  Config.option(Config.String(name)).pipe(Config.map(Option.filter((value) => value.length > 0)))

// Each provider and the environment key it reads; keys never come from anywhere else.
const PROVIDER_KEYS = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  jev: 'TYPESAFE_API_KEY',
} as const
type Provider = keyof typeof PROVIDER_KEYS

export interface ModelRef {
  provider: Provider
  id: string
}

// `provider:model` into a model reference, or none for any other shape.
export const parseModel = (value: string): Option.Option<ModelRef> => {
  const at = value.indexOf(':')
  const provider = value.slice(0, at)
  const id = value.slice(at + 1)
  return at > 0 && id.length > 0 && Object.hasOwn(PROVIDER_KEYS, provider)
    ? Option.some({ provider: provider as Provider, id })
    : Option.none()
}

// The model when it parses and its provider's key is set, else none.
export const modelRef = Effect.gen(function* () {
  const model = Option.flatMap(yield* present('WEBULAR_AGENT_MODEL'), parseModel)
  if (Option.isNone(model) || model.value.provider === 'jev') return model
  const key = yield* present(PROVIDER_KEYS[model.value.provider])
  return Option.isSome(key) ? model : Option.none<ModelRef>()
}).pipe(Effect.orElseSucceed(() => Option.none<ModelRef>()))

export const load = <A>(importer: () => Promise<A>) =>
  Effect.tryPromise({ try: importer, catch: (cause) => cause })

// The provider's model; its factory reads the key from the environment.
export const loadModel = (model: ModelRef | undefined) =>
  model === undefined
    ? Effect.succeed(undefined)
    : model.provider === 'anthropic'
      ? Effect.map(
          load(() => import('@ai-sdk/anthropic')),
          (m) => m.anthropic(model.id),
        )
      : Effect.map(
          load(() => import('@ai-sdk/openai')),
          (m) => m.openai(model.id),
        )
