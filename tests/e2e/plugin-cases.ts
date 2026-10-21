// Plugin cases: each runs one command from the repo root and passes on exit 0.
// `covers` names the coverage-map kinds it checks for every item of that kind:
// server.test.ts lists every plugin tool through a real stdio MCP client,
// `claude plugin validate` checks the manifest and each skill, and
// check-evals checks each skill's eval cases. A case whose `needs` binary is
// not on PATH is reported as skip, never pass.
// ponytail: the skills' model-graded evals need a model key, so this
// network-free run checks their eval files; run them with a key when one is set.
export interface PluginCase {
  name: string
  argv: string[]
  covers: string[]
  needs?: string
}

export const PLUGIN_CASES: PluginCase[] = [
  {
    name: 'every plugin tool over stdio',
    argv: [
      'bun',
      'test',
      '--timeout',
      '30000',
      '-t',
      'one typed tool',
      'plugins/webular/tests/server.test.ts',
    ],
    covers: ['plugin tool'],
  },
  {
    name: 'claude plugin validate',
    argv: ['claude', 'plugin', 'validate', 'plugins/webular'],
    covers: ['skill'],
    needs: 'claude',
  },
  {
    name: 'skill evals',
    argv: ['bun', 'plugins/webular/scripts/check-evals.ts'],
    covers: ['skill'],
  },
]
