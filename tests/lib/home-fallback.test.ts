// Windows sets USERPROFILE, not HOME: state folders must land under it, never
// in the current working folder.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Option } from 'effect'
import { recorderConfig } from '../../src/lib/jev/learn/recorder.ts'
import { eff } from '../_support/run.ts'

test(
  'Jev call recorder writes under USERPROFILE when HOME is unset',
  eff(
    recorderConfig.pipe(
      Effect.map((cfg) =>
        expect(cfg.path).toEqual(Option.some('C:/Users/k/.local/state/webular/jev-calls.jsonl')),
      ),
      Effect.provide(
        ConfigProvider.layer(ConfigProvider.fromUnknown({ USERPROFILE: 'C:/Users/k' })),
      ),
    ),
  ),
)
