// Which install channel a webular executable came from, and the one command
// that upgrades it. Pure: callers pass the executable paths and the env, so
// every channel is provable without touching the machine. A path that matches
// no channel gets the GitHub releases page.
import { WINGET_ID } from './winget.ts'

type Channel =
  | 'homebrew'
  | 'scoop'
  | 'winget'
  | 'bun'
  | 'npm'
  | 'install.sh'
  | 'install.ps1'
  | 'unknown'
interface Upgrade {
  channel: Channel
  command: string
}

const RELEASES = 'https://github.com/srinitude/webular/releases/latest'
const INSTALL_SH = "curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh"
const INSTALL_PS1 = 'irm https://webular.dev/install.ps1 | iex'

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

// install.sh and install.ps1 land in $WEBULAR_INSTALL/bin, or ~/.webular/bin
// when it is unset; install.ps1 installs webular.exe.
function installerOf(path: string, env: Readonly<Record<string, string | undefined>>): Upgrade {
  const dir = normalize(env['WEBULAR_INSTALL'] ?? '').replace(/\/$/, '')
  const custom = dir !== '' && path.startsWith(`${dir}/bin/`)
  if (!custom && !/\/\.webular\/bin\//i.test(path)) return { channel: 'unknown', command: RELEASES }
  if (/\.exe$/i.test(path)) {
    const pin = custom ? `$env:WEBULAR_INSTALL='${dir}'; ` : ''
    return { channel: 'install.ps1', command: `${pin}${INSTALL_PS1}` }
  }
  const pin = custom ? `| WEBULAR_INSTALL=${dir} sh` : '| sh'
  return { channel: 'install.sh', command: INSTALL_SH.replace('| sh', pin) }
}

function channelOf(raw: string, env: Readonly<Record<string, string | undefined>>): Upgrade {
  const path = normalize(raw)
  const rule = RULES.find(([, re]) => re.test(path))
  if (rule) return { channel: rule[0], command: rule[2] }
  return installerOf(path, env)
}

// The first path that names a channel wins; none names one -> unknown.
export function upgradeFor(
  paths: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): Upgrade {
  const found = paths.map((p) => channelOf(p, env)).find((u) => u.channel !== 'unknown')
  return found ?? { channel: 'unknown', command: RELEASES }
}
