// Guard: Jev is the only API key webular reads. Every env read, Config read,
// key-shaped string, and macOS Keychain lookup in src/ and plugins/webular/src
// must name a Jev key, from TypeSafe or a Jev provider such as OpenRouter.
// Settings that are not credentials (WEBULAR_TRACE and the like) pass.

import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

// The Jev key names: TypeSafe's env var and Keychain item, and the Pydantic AI
// Gateway key, which routes to Jev when no direct key is set.
const JEV_KEYS = new Set([
  'TYPESAFE_API_KEY',
  'typesafe-ai-api-key',
  'PYDANTIC_AI_GATEWAY_API_KEY',
])

const ENV = /\b(?:process|Bun)\.env(?:\.([A-Za-z_]\w*)|\[\s*['"`]([^'"`]+)['"`]\s*\])/g
const CONFIG = /\bConfig\.(\w+)\(\s*['"`]([^'"`]+)['"`]/g
const KEYCHAIN = /find-(?:generic|internet)-password\b[^\n]*?\s-s\s+['"]?([\w.-]+)/g
const KEY_LITERAL = /['"`]([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?))['"`]/g
const CREDENTIAL = /key|token|secret|password|credential|auth/i

// Every non-Jev credential the text reads, with the form that read it.
const offences = (text: string): string[] => {
  const found: Array<[name: string, how: string, secret: boolean]> = []
  for (const m of text.matchAll(ENV)) found.push([m[1] ?? m[2] ?? '', 'env', false])
  for (const m of text.matchAll(CONFIG))
    found.push([m[2] ?? '', `Config.${m[1]}`, m[1] === 'Redacted'])
  for (const m of text.matchAll(KEYCHAIN)) found.push([m[1] ?? '', 'Keychain', true])
  for (const m of text.matchAll(KEY_LITERAL)) found.push([m[1] ?? '', 'literal', false])
  // One line per name: a read form wins over the bare literal it also matches.
  const byName = new Map<string, string>()
  for (const [name, how, secret] of found)
    if ((secret || CREDENTIAL.test(name)) && !JEV_KEYS.has(name) && !byName.has(name))
      byName.set(name, `${how} ${name}`)
  return [...byName.values()]
}

const SCANNED = ['src', 'plugins/webular/src']

const scan = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const ls = yield* runProc(
    ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '--', ...SCANNED],
    { timeoutMs: 10_000, cwd: ROOT },
  )
  const files = ls.stdout.split('\n').filter((f) => /\.(ts|js|mjs|sh)$/.test(f))
  const hits = yield* Effect.forEach(
    files,
    (f) =>
      Effect.map(fs.readFileString(`${ROOT}${f}`), (text) =>
        offences(text).map((o) => `${f}: ${o}`),
      ),
    { concurrency: 16 },
  )
  return { files, bad: hits.flat() }
})

// Planted reads, built at run time so no gate mistakes them for real ones.
const configRead = (kind: string, name: string) => `Config.${kind}('${name}')`

// The non-Jev keys webular once read.
const REMOVED = [
  'OPENALEX_API_KEY',
  'MARGINALIA_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
]

describe('Jev is the only API key', () => {
  test(
    'src/ and plugins/webular/src read no key but Jev',
    eff(
      Effect.map(scan, ({ files, bad }) => {
        expect(files.length).toBeGreaterThan(50)
        expect(bad).toEqual([])
      }),
    ),
    30_000,
  )

  test('a planted Brave key read fails in every form, and Jev reads pass', () => {
    const brave = 'BRAVE_API_KEY'
    expect(offences(configRead('Redacted', brave))).toEqual([`Config.Redacted ${brave}`])
    expect(offences(configRead('String', brave))).toEqual([`Config.String ${brave}`])
    expect(offences(`process.env.${brave}`)).toEqual([`env ${brave}`])
    expect(offences("Bun.env['GITHUB_TOKEN']")).toEqual(['env GITHUB_TOKEN'])
    expect(offences('security find-generic-password -s brave-api-key -w')).toEqual([
      'Keychain brave-api-key',
    ])
    expect(offences(`const KEYS = { brave: '${brave}' }`)).toEqual([`literal ${brave}`])
    expect(offences(configRead('Redacted', 'TYPESAFE_API_KEY'))).toEqual([])
    expect(offences('security find-generic-password -s typesafe-ai-api-key -w')).toEqual([])
    expect(offences(configRead('String', 'WEBULAR_TRACE'))).toEqual([])
  })
})

test('every removed key name fails if it comes back', () => {
  for (const removed of REMOVED)
    expect(offences(configRead('Redacted', removed))).toEqual([`Config.Redacted ${removed}`])
})
