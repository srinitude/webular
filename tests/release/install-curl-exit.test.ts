// scripts/install.sh names a missing release whichever exit code curl uses for
// the 404 under -f: 22 on HTTP/1.1, and 56 from macOS curl over HTTP/2.
import { expect, test } from 'bun:test'
import { Config, Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fakeCurl = (code: number) =>
  `#!/bin/sh\necho "curl: (${code}) The requested URL returned error: 404" >&2\nexit ${code}\n`

for (const code of [22, 56]) {
  test.skipIf(process.platform === 'win32')(
    `names a missing release when curl reports the 404 as exit ${code}`,
    eff(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const home = yield* tmpDir('install-curl-exit-')
        yield* fs.makeDirectory(`${home}/bin`)
        yield* fs.writeFileString(`${home}/bin/curl`, fakeCurl(code))
        yield* fs.chmod(`${home}/bin/curl`, 0o755)
        const path = yield* Config.String('PATH')
        const env = {
          HOME: home,
          PATH: `${home}/bin:${path}`,
          WEBULAR_INSTALL: '',
          WEBULAR_BASE_URL: 'https://example.invalid/release',
          WEBULAR_OS: 'linux',
          WEBULAR_ARCH: 'x64',
          WEBULAR_LIBC: 'glibc',
          WEBULAR_BASELINE: '0',
          WEBULAR_VERIFY_ATTESTATION: '0',
        }
        const argv = ['sh', `${ROOT}scripts/install.sh`, '--version', '9.9.9']
        const out = yield* runProc(argv, { env, extendEnv: true, timeoutMs: 30_000 })
        expect(out.code).not.toBe(0)
        expect(out.stderr).toContain('Release v9.9.9 not found')
        expect(yield* fs.exists(`${home}/.webular/bin/webular`)).toBe(false)
      }),
    ),
  )
}
