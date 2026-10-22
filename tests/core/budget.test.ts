// Host budget contract: simulated cgroup files and memory sizes must shrink
// the fetch fan-out on small hosts, grow it on large ones within the ceiling,
// and honor the WEBULAR_CONCURRENCY override.
import { describe, expect, test } from 'bun:test'
import { availableParallelism } from 'node:os'
import { Effect, type FileSystem } from 'effect'
import { deriveBudget, type HostBudget, hostBudget, readHost } from '../../src/core/budget.ts'
import { eff } from '../_support/run.ts'

const GiB = 1024 ** 3
const CPUS = availableParallelism()
const hostOf = (map: Record<string, string>, os = 'linux') =>
  readHost((path) => Effect.succeed(map[path] ?? null), os)
const cpusOf = (map: Record<string, string>, os = 'linux') =>
  hostOf(map, os).pipe(Effect.map((h) => h.cpus))
const check = (body: () => Effect.Effect<void, never, FileSystem.FileSystem | HostBudget>) =>
  eff(Effect.suspend(body))
const splitHierarchy = (quota: string) => ({
  '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': quota,
  '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000',
  '/sys/fs/cgroup/memory/memory.limit_in_bytes': '9223372036854771712',
})

describe('readHost — cgroup limits on Linux', () => {
  test(
    'unified cpu.max and memory.max cap the host values',
    check(() =>
      hostOf({
        '/sys/fs/cgroup/cpu.max': '150000 100000',
        '/sys/fs/cgroup/memory.max': '536870912',
      }).pipe(
        Effect.flatMap((limits) =>
          Effect.sync(() => {
            expect(limits.cpus).toBe(Math.min(2, CPUS))
            expect(limits.memoryBytes).toBeLessThanOrEqual(512 * 1024 * 1024)
          }),
        ),
      ),
    ),
  )

  test(
    'unified "max" means no limit',
    check(() =>
      cpusOf({ '/sys/fs/cgroup/cpu.max': 'max 100000' }).pipe(
        Effect.map((cpus) => expect(cpus).toBe(CPUS)),
      ),
    ),
  )

  test(
    'split quota/period, with -1 as unlimited',
    check(() =>
      Effect.zipWith(cpusOf(splitHierarchy('100000')), cpusOf(splitHierarchy('-1')), (one, all) => {
        expect(one).toBe(1)
        expect(all).toBe(CPUS)
      }),
    ),
  )

  test(
    'macOS and Windows ignore cgroup files',
    check(() => {
      const files = { '/sys/fs/cgroup/cpu.max': '100000 100000' }
      return Effect.zipWith(cpusOf(files, 'darwin'), cpusOf(files, 'win32'), (mac, win) => {
        expect(mac).toBe(CPUS)
        expect(win).toBe(CPUS)
      })
    }),
  )
})

describe('deriveBudget — concurrency from host limits', () => {
  test('a tiny container is memory-bound below the default', () => {
    expect(deriveBudget({ cpus: 1, memoryBytes: 0.5 * GiB }).concurrency).toBe(2)
  })

  test('never drops below one in-flight fetch', () => {
    expect(deriveBudget({ cpus: 1, memoryBytes: 1 }).concurrency).toBe(1)
  })

  test('a big host scales with CPUs up to the ceiling', () => {
    expect(deriveBudget({ cpus: 8, memoryBytes: 64 * GiB }).concurrency).toBe(8)
    expect(deriveBudget({ cpus: 128, memoryBytes: 512 * GiB }).concurrency).toBe(16)
  })

  test('small CPU counts keep the floor of four when memory allows', () => {
    expect(deriveBudget({ cpus: 2, memoryBytes: 8 * GiB }).concurrency).toBe(4)
  })

  test('an override wins, clamped to 1..32', () => {
    const big = { cpus: 8, memoryBytes: 64 * GiB }
    expect(deriveBudget(big, 3).concurrency).toBe(3)
    expect(deriveBudget(big, 999).concurrency).toBe(32)
  })

  test(
    'hostBudget reads once and caches',
    check(() =>
      Effect.zipWith(hostBudget(), hostBudget(), (first, second) => {
        expect(second).toBe(first)
        expect(first.concurrency).toBeGreaterThanOrEqual(1)
      }),
    ),
  )
})
