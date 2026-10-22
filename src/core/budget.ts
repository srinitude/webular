// Host-sized budgets: read the machine's real limits once per process
// (CPU affinity, free memory, Linux cgroup quotas in either hierarchy) and
// derive the fetch fan-out from them. Pure derive + injectable reader keeps
// it testable with simulated limits; WEBULAR_CONCURRENCY overrides the result.
import { availableParallelism, freemem, platform, totalmem } from 'node:os'
import { Config, Context, Data, Effect, FileSystem, Layer, Option, Schema } from 'effect'

interface HostLimits {
  cpus: number
  memoryBytes: number
}

interface Budget extends HostLimits {
  concurrency: number
}

type ReadFile = (path: string) => Effect.Effect<string | null, never, FileSystem.FileSystem>

// Worst case per in-flight fetch: the 25 MiB text cap held as a UTF-16
// string plus its parsed DOM — about 4x the byte cap.
const PER_FETCH_BYTES = 100 * 1024 * 1024
const FLOOR = 1
const CPU_FLOOR = 4
const CEILING = 16
const OVERRIDE_CEILING = 32

const readOrNull: ReadFile = (path) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return (yield* fs.readFileString(path)).trim()
  }).pipe(Effect.orElseSucceed(() => null))

const positive = (n: number): number | null => (Number.isFinite(n) && n > 0 ? n : null)

// Unified hierarchy: `cpu.max` is "<quota|max> <period>". Split hierarchy:
// `cpu.cfs_quota_us` / `cpu.cfs_period_us`, with -1 meaning unlimited.
const cgroupCpus = (read: ReadFile) =>
  Effect.gen(function* () {
    const unified = (yield* read('/sys/fs/cgroup/cpu.max'))?.split(' ')
    if (unified)
      return unified[0] === 'max' ? null : positive(Number(unified[0]) / Number(unified[1]))
    const quota = Number(yield* read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'))
    return positive(quota / Number(yield* read('/sys/fs/cgroup/cpu/cpu.cfs_period_us')))
  })

// The split hierarchy reports "unlimited" as a near-2^63 value; the min() in
// readHost treats anything above the host's free memory as no limit.
const cgroupMemory = (read: ReadFile) =>
  Effect.gen(function* () {
    const unified = yield* read('/sys/fs/cgroup/memory.max')
    if (unified) return unified === 'max' ? null : positive(Number(unified))
    return positive(Number(yield* read('/sys/fs/cgroup/memory/memory.limit_in_bytes')))
  })

// availableParallelism() honors process affinity everywhere. freemem() is
// MemAvailable on Linux and available physical memory on Windows, but on
// macOS it leaves out reclaimable file cache, so macOS uses totalmem().
// Windows job-object caps are not readable without native code.
export const readHost = (read: ReadFile = readOrNull, os: string = platform()) =>
  Effect.gen(function* () {
    const cpus = availableParallelism()
    const mem = os === 'darwin' ? totalmem() : freemem()
    if (os !== 'linux') return { cpus, memoryBytes: mem }
    const [quota, limit] = yield* Effect.all([cgroupCpus(read), cgroupMemory(read)], {
      concurrency: 2,
    })
    return {
      cpus: Math.max(1, Math.min(cpus, Math.ceil(quota ?? cpus))),
      memoryBytes: Math.min(mem, limit ?? mem),
    }
  })

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

// override <= 0 means "derive from the host".
export function deriveBudget(host: HostLimits, override = 0): Budget {
  if (override > 0) return { ...host, concurrency: clamp(override, FLOOR, OVERRIDE_CEILING) }
  const byMemory = Math.floor(host.memoryBytes / 2 / PER_FETCH_BYTES)
  const byCpu = clamp(host.cpus, CPU_FLOOR, CEILING)
  return { ...host, concurrency: clamp(Math.min(byCpu, byMemory), FLOOR, CEILING) }
}

class BudgetConfigError extends Data.TaggedError('BudgetConfigError')<{ message: string }> {}

const PositiveInt = Schema.NumberFromString.pipe(
  Schema.decodeTo(Schema.Int.check(Schema.isGreaterThan(0))),
)

// Unset means "derive from the host" (0); anything else must be a positive integer.
const override = Effect.gen(function* () {
  const raw = yield* Config.option(Config.String('WEBULAR_CONCURRENCY'))
  if (Option.isNone(raw)) return 0
  return yield* Schema.decodeUnknownEffect(PositiveInt)(raw.value).pipe(
    Effect.mapError(
      () =>
        new BudgetConfigError({
          message: `WEBULAR_CONCURRENCY must be a positive integer, got "${raw.value}"`,
        }),
    ),
  )
})

// The override is checked when the layer is built; the host reads are memoized
// and run on first use, so commands that never fan out never pay for them.
export class HostBudget extends Context.Service<
  HostBudget,
  { readonly budget: Effect.Effect<Budget> }
>()('webular/core/HostBudget') {
  static readonly layer = Layer.effect(
    HostBudget,
    Effect.gen(function* () {
      const n = yield* override
      const fs = yield* FileSystem.FileSystem
      const host = readHost().pipe(Effect.provideService(FileSystem.FileSystem, fs))
      return { budget: yield* Effect.cached(Effect.map(host, (h) => deriveBudget(h, n))) }
    }),
  )
}

export const hostBudget = () => HostBudget.use((b) => b.budget)

// The fan-out bound for Effect callers: the same memoized host read.
export const hostConcurrency = Effect.map(hostBudget(), (b) => b.concurrency)
