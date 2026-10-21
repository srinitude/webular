// Which install channel a webular executable came from, and the one command
// that upgrades it. Pure: callers pass the executable paths and the env, so
// every channel is provable without touching the machine. A path that matches
// no channel gets the GitHub releases page.
import { WINGET_ID } from './winget.ts'

type Channel = 'homebrew' | 'scoop' | 'winget' | 'bun' | 'npm' | 'install.sh' | 'unknown'
interface Upgrade {
  channel: Channel
  command: string
}

const RELEASES = 'https://github.com/srinitude/webular/releases/latest'
const INSTALL_SH = `curl -fsSL ${RELEASES}/download/install.sh | sh`

// node_modules rules come first: a Homebrew- or Scoop-installed Node keeps its
// global packages under its own prefix, and those upgrade through the package
// manager that owns the package, not the one that owns Node.
const RULES: readonly (readonly [Channel, RegExp, string])[] = [
  ['bun', /\/\.bun\/.*\/node_modules\/webular(-[\w-]+)?\//i, 'bun add -g webular@latest'],
  ['npm', /\/node_modules\/webular(-[\w-]+)?\//i, 'npm install -g webular@latest'],
  [
    'homebrew',
    /(\/cellar\/webular\/|\/(homebrew|\.linuxbrew)\/bin\/webular$)/i,
    'brew upgrade webular',
  ],
  ['scoop', /\/scoop\/(apps\/webular|shims)\//i, 'scoop update webular'],
  ['winget', /\/winget\/(packages|links)\//i, `winget upgrade ${WINGET_ID}`],
]

const normalize = (path: string): string => path.replaceAll('\\', '/')

// install.sh lands in $WEBULAR_INSTALL/bin, or ~/.webular/bin when it is unset.
function installShCommand(path: string, env: Readonly<Record<string, string | undefined>>) {
  const dir = normalize(env['WEBULAR_INSTALL'] ?? '').replace(/\/$/, '')
  if (dir && path.startsWith(`${dir}/bin/`))
    return INSTALL_SH.replace('| sh', `| WEBULAR_INSTALL=${dir} sh`)
  return /\/\.webular\/bin\//i.test(path) ? INSTALL_SH : undefined
}

function channelOf(raw: string, env: Readonly<Record<string, string | undefined>>): Upgrade {
  const path = normalize(raw)
  const rule = RULES.find(([, re]) => re.test(path))
  if (rule) return { channel: rule[0], command: rule[2] }
  const script = installShCommand(path, env)
  return script
    ? { channel: 'install.sh', command: script }
    : { channel: 'unknown', command: RELEASES }
}

// The first path that names a channel wins; none names one -> unknown.
export function upgradeFor(
  paths: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): Upgrade {
  const found = paths.map((p) => channelOf(p, env)).find((u) => u.channel !== 'unknown')
  return found ?? { channel: 'unknown', command: RELEASES }
}
