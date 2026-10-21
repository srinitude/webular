// Effect code yields its Effects; it never starts a second run inside one.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { eff, io } from '../_support/run.ts'

const FILES = ['src/lib/jev/run.ts', 'src/core/effect.ts']

test.each(FILES)('%s starts no nested Effect run', (file) =>
  eff(
    Effect.map(
      io(() => Bun.file(file).text()),
      (text) => expect(text).not.toMatch(/\.run(Sync|Promise|Fork|Callback)\w*\(/),
    ),
  )(),
)
