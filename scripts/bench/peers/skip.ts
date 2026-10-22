// Why a (provider, task) pair does not run. A robots-gold task (a fixture URL
// the fixture robots.txt disallows) is graded on the HTTP requests the tool
// made, and no peer here exposes its target-site requests, so it is reported
// unsupported, never scored.
import { ROBOTS_TXT } from '../../../bench/fixtures/server.ts'
import { robotsDisallowed } from '../guards.ts'
import type { Provider, Task } from './model.ts'

const robotsGold = (task: Task) =>
  task.input.url?.startsWith('{fixture}') === true &&
  robotsDisallowed(ROBOTS_TXT, [task.input.url.replace('{fixture}', 'http://fixture')]).length > 0

export const skipReason = (p: Provider, task: Task) =>
  p.skip
    ? (['skipped', p.skip] as const)
    : !p.jobs[task.job]
      ? (['unsupported', `no ${task.job} API`] as const)
      : robotsGold(task)
        ? (['unsupported', 'peer does not expose its target-site requests'] as const)
        : task.localOnly && !p.local
          ? (['unsupported', 'local fixture unreachable from a hosted API'] as const)
          : undefined
