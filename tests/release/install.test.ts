// scripts/install.sh against a local release folder (file:// base URL): it
// installs the asset for this host when the checksum matches, and installs
// nothing when SHA256SUMS disagrees with the download.
import { afterAll, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, ManagedRuntime } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { assetName, hostFacts, targetFor } from '../../src/core/platform.ts'
import { ROOT } from '../_support/root.ts'

const runtime = ManagedRuntime.make(BunServices.layer)
afterAll(() => runtime.dispose())

const BINARY = '#!/bin/sh\necho fixture-ok\n'
const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex')

const install = (sum: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const target = targetFor(yield* hostFacts)
    if (!target) return yield* Effect.die('host has no webular target')
    const dir = yield* fs.makeTempDirectoryScoped()
    const asset = assetName(target)
    yield* fs.writeFileString(`${dir}/${asset}`, BINARY)
    yield* fs.writeFileString(`${dir}/SHA256SUMS`, `${sum}  ${asset}\n`)
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const code = yield* spawner.exitCode(
      ChildProcess.make('sh', [`${ROOT}scripts/install.sh`], {
        env: { WEBULAR_BASE_URL: `file://${dir}`, WEBULAR_INSTALL: `${dir}/home` },
        extendEnv: true,
        stdout: 'ignore',
        stderr: 'ignore',
      }),
    )
    const exe = `${dir}/home/bin/webular`
    const installed = (yield* fs.exists(exe)) ? yield* fs.readFileString(exe) : undefined
    return { code: Number(code), installed }
  }).pipe(Effect.scoped)

test('installs the host asset when its checksum matches', () =>
  runtime.runPromise(
    Effect.map(install(sha256(BINARY)), ({ code, installed }) => {
      expect(code).toBe(0)
      expect(installed).toBe(BINARY)
    }),
  ))

test('refuses a download whose checksum does not match', () =>
  runtime.runPromise(
    Effect.map(install('0'.repeat(64)), ({ code, installed }) => {
      expect(code).not.toBe(0)
      expect(installed).toBeUndefined()
    }),
  ))
