// The stdio MCP tests start the server with a host's minimal env; the mise trust
// variable must survive it, or `mise tasks ls` refuses the repo's mise.toml.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { mcpHostEnv } from '../_support/mcp-env.ts'

const envWith = (vars: Record<string, string>) =>
  mcpHostEnv.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(vars))))

test('the MCP host env keeps MISE_TRUSTED_CONFIG_PATHS only when it is set', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const set = yield* envWith({ MISE_TRUSTED_CONFIG_PATHS: '/repo' })
      expect(set['MISE_TRUSTED_CONFIG_PATHS']).toBe('/repo')
      expect('MISE_TRUSTED_CONFIG_PATHS' in (yield* envWith({}))).toBe(false)
    }),
  ))
