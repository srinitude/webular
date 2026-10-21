// upgrade: each install channel maps to its own upgrade command, from the
// executable path alone (Windows backslashes included); anything else gets the
// GitHub releases page.
import { describe, expect, test } from 'bun:test'
import { upgradeFor } from '../../src/release/upgrade.ts'

const RELEASES = 'https://github.com/srinitude/webular/releases/latest'
const INSTALL_SH = `curl -fsSL ${RELEASES}/download/install.sh | sh`
const BREW = 'brew upgrade webular'
const NPM = 'npm install -g webular@latest'
const SCOOP = 'scoop update webular'
const WINGET_DIR = 'C:\\Users\\a\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Srinitude.Webular_x'

const cases = [
  ['homebrew arm', '/opt/homebrew/Cellar/webular/1.2.3/bin/webular', 'homebrew', BREW],
  ['homebrew intel', '/usr/local/Cellar/webular/1.2.3/bin/webular', 'homebrew', BREW],
  ['homebrew link', '/opt/homebrew/bin/webular', 'homebrew', BREW],
  ['linuxbrew', '/home/linuxbrew/.linuxbrew/Cellar/webular/1.2.3/bin/webular', 'homebrew', BREW],
  ['scoop', 'C:\\Users\\a\\scoop\\apps\\webular\\current\\webular.exe', 'scoop', SCOOP],
  ['scoop shim', 'C:\\Users\\a\\scoop\\shims\\webular.exe', 'scoop', SCOOP],
  ['winget', `${WINGET_DIR}\\webular.exe`, 'winget', 'winget upgrade Srinitude.Webular'],
  ['npm', '/usr/lib/node_modules/webular/dist/webular.js', 'npm', NPM],
  [
    'npm platform',
    '/usr/lib/node_modules/webular/node_modules/webular-linux-x64/bin/webular',
    'npm',
    NPM,
  ],
  ['npm, homebrew node', '/opt/homebrew/lib/node_modules/webular/dist/webular.js', 'npm', NPM],
  [
    'bun global',
    '/Users/a/.bun/install/global/node_modules/webular/dist/webular.js',
    'bun',
    'bun add -g webular@latest',
  ],
  ['install.sh', '/Users/a/.webular/bin/webular', 'install.sh', INSTALL_SH],
  ['unknown', '/usr/local/bin/webular', 'unknown', RELEASES],
] as const

describe('upgradeFor — one command per install channel', () => {
  test.each(cases)('%s', (_name, path, channel, command) => {
    expect(upgradeFor([path], {})).toEqual({ channel, command })
  })

  test('a custom WEBULAR_INSTALL dir is an install.sh install and is passed back', () => {
    const got = upgradeFor(['/opt/tools/bin/webular'], { WEBULAR_INSTALL: '/opt/tools' })
    expect(got).toEqual({
      channel: 'install.sh',
      command: `curl -fsSL ${RELEASES}/download/install.sh | WEBULAR_INSTALL=/opt/tools sh`,
    })
  })

  test('the first path that names a channel wins; empty input is unknown', () => {
    expect(upgradeFor(['/tmp/x', '/Users/a/.webular/bin/webular'], {}).channel).toBe('install.sh')
    expect(upgradeFor([], {})).toEqual({ channel: 'unknown', command: RELEASES })
  })
})
