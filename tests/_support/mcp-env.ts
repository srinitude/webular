// The environment an MCP host gives a stdio server: the SDK's minimal default,
// plus MISE_TRUSTED_CONFIG_PATHS when it is set. CI trusts the repo through that
// variable (jdx/mise-action sets it, so `mise trust` finds nothing to write), and
// without it the server's `mise tasks ls` refuses mise.toml as untrusted.
import { getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Config, Effect, Option } from 'effect'

export const mcpHostEnv = Effect.gen(function* () {
  const trusted = yield* Config.option(Config.String('MISE_TRUSTED_CONFIG_PATHS'))
  const extra = Option.match(trusted, {
    onNone: () => ({}),
    onSome: (paths) => ({ MISE_TRUSTED_CONFIG_PATHS: paths }),
  })
  return { ...getDefaultEnvironment(), ...extra }
})
