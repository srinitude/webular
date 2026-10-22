// agent-browser binary choice on every OS: a launcher found on PATH (bun's
// Windows .exe in node_modules\.bin) falls through to the package's native
// binary, and every native name points at a binary the package ships.
import { expect, test } from 'bun:test'
import { dirname, join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { nativeName, pickBin } from '../../src/lib/agentbrowser.ts'
import { eff, tmpDir } from '../_support/run.ts'

const WINDOWS_LAUNCHER = 'C:\\a\\webular\\webular\\node_modules\\.bin\\agent-browser.exe'

test(
  'a Windows launcher on PATH falls through to the native binary',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* tmpDir('webular-native-bin-')
      const native = nativeName('win32', 'arm64') ?? ''
      yield* fs.writeFileString(join(dir, native), '')
      yield* fs.chmod(join(dir, native), 0o755)
      const bin = yield* pickBin(WINDOWS_LAUNCHER, native, dir)
      expect(bin).toBe(join(dir, native))
      expect(yield* pickBin('/opt/agent-browser', native, dir)).toBe('/opt/agent-browser')
    }),
  ),
)

test(
  'every native name is a binary the package ships',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const bins = join(
        dirname(Bun.resolveSync('agent-browser/package.json', import.meta.dir)),
        'bin',
      )
      const pairs = [
        ['darwin', 'arm64'],
        ['darwin', 'x64'],
        ['win32', 'x64'],
        ['win32', 'arm64'],
      ] as const
      const missing = yield* Effect.filter(
        pairs.map(([platform, arch]) => nativeName(platform, arch) ?? ''),
        (name) => Effect.map(fs.exists(join(bins, name)), (ok) => !ok),
        { concurrency: 4 },
      )
      expect(missing).toEqual([])
      expect(nativeName('linux', 'x64')).toBeNull()
    }),
  ),
)
